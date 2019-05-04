const express = require('express');
const path = require('path');
const utils = require('./lib/hashUtils');
const partials = require('express-partials');
const bodyParser = require('body-parser');
const Auth = require('./middleware/auth');
const models = require('./models');
const Model = require('./models/model.js');

const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));



app.get('/', 
(req, res) => {
  res.render('index');
});

app.get('/create', 
(req, res) => {
  res.render('index');
});

app.get('/links', 
(req, res, next) => {
  models.Links.getAll()
    .then(links => {
      res.status(200).send(links);
    })
    .error(error => {
      res.status(500).send(error);
    });
});

app.post('/links', 
(req, res, next) => {
  var url = req.body.url;
  if (!models.Links.isValidUrl(url)) {
    // send back a 404 if link is not valid
    return res.sendStatus(404);
  }

  return models.Links.get({ url })
    .then(link => {
      if (link) {
        throw link;
      }
      return models.Links.getUrlTitle(url);
    })
    .then(title => {
      return models.Links.create({
        url: url,
        title: title,
        baseUrl: req.headers.origin
      });
    })
    .then(results => {
      return models.Links.get({ id: results.insertId });
    })
    .then(link => {
      throw link;
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(link => {
      res.status(200).send(link);
    });
});

app.post('/signup', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  return models.Users.create({ username, password})
    .then(result => {
      models.Sessions.create();
      throw result;
      // or use middleware auth.js => Auth.createSession
    })
    .error(error => {
      res.redirect('/signup');
      res.status(500).end('Not able to create user profile: ', error);
    })
    .catch(result => {
      res.redirect('/');
      res.status(201).end('Sign up successful');
    });
}); 

app.post('/login', (req, res) => {
  var username = req.body.username;
  var options = {
    username: username
  };

  var newUsers = new Model('users');
  
  return newUsers.get(options)
    .then(result => {
      return models.Users.compare(req.body.password, result.password, result.salt);
    })
    // .then(result => {
    //   models.Sessions.create();
    //   return result;
    //   // or use middleware auth.js => Auth.createSession
    // })
    // .then(result => {
    //   res.redirect('/');
    //   res.status(201).end('Login successful');
    // })
    .error(error => {
      res.redirect('/login');
      res.status(500).end('Login not successful');
    })
    .catch(result => {
      res.redirect('/');
      res.status(201).end('Login successful');
    })
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the code parameter route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/:code', (req, res, next) => {

  return models.Links.get({ code: req.params.code })
    .tap(link => {

      if (!link) {
        throw new Error('Link does not exist');
      }
      return models.Clicks.create({ linkId: link.id });
    })
    .tap(link => {
      return models.Links.update(link, { visits: link.visits + 1 });
    })
    .then(({ url }) => {
      res.redirect(url);
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(() => {
      res.redirect('/');
    });
});

module.exports = app;
