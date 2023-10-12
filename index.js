const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const bodyParser = require('body-parser');

const mongoose = require('mongoose');

app.use(cors())
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Connect to database;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true })
        .then(() => { console.log('connected to database, ready to proceed'); })
        .catch(() => { console.error('somethings wrong, cant even connect to database'); });

const logSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true
  },
  count: {
    type: Number,
    default: 0
  },
  log: [{
    description: {type: String, required: true},
    duration: {type: Number, required: true},
    date: {type: String, required: true}
  }]
});

const Log = mongoose.model("Log", logSchema);

app.post('/api/users', function(req, res) {
  console.log(`ACTION: Posting new username "${req.body.username}" to database...`);

  Log.create({ username: req.body.username })
      .then(data => { console.log('New user log created. Here is the new user log: '); console.log(data); res.json({username: data.username, _id: data._id}); console.log('ACTION COMPLETED') })
      .catch(() => { 
        console.log('Existing user log probably already exists. Here is the existing user log: '); 
        Log.findOne({ username: req.body.username })
           .then(data => { console.log(data); res.json({username: data.username, _id: data._id}); console.log('ACTION COMPLETED')})
           .catch(error => { console.log('Hmm... cant find existing log for some reason. Here is the error message: '); console.log(error); res.json({error: 'Having trouble here...'})});
      });
});

app.get('/api/users', function(req, res) {
  console.log(`ACTION: Getting all the users from the database...`);

  Log.find({})
     .then(data => {
      console.log("Here is the requested data:")
      console.log(data.map(obj => {
        return { _id: obj._id, username: obj.username };
      }));
      res.send(data.map(obj => {
        return { _id: obj._id, username: obj.username };
      }));
      console.log(`ACTION COMPLETED`);
     })
     .catch(error => {
      console.log('Hmm... cant find users for some reason. Here is the error message: '); 
      console.log(error); 
      res.send('Having trouble here...');
     });
});

app.post('/api/users/:_id/exercises', function(req, res) {
  console.log(`ACTION: Adding an exercise to the log of user ${req.params._id}...`);
  console.log(req.body.description, req.body.duration, req.body.date);
  Log.findOneAndUpdate(
    { _id: req.params._id }, 
    { $push: {
        log: {
          description: req.body.description,
          duration: parseInt(req.body.duration),
          date: new Date(req.body.date).toDateString() !== 'Invalid Date' ? new Date(req.body.date).toDateString() : new Date().toDateString()
        }
      },
      $inc: {
        count: 1
      }
    },
    {
      new: true
    }
  )
    .then(data => {
      console.log("Data added to the user's log. Here is the new user log:");
      console.log(data);
      console.log(new Date(req.body.date).toDateString());
      res.json({
        _id: req.params._id,
        username: data.username,
        description: req.body.description,
        duration: parseInt(req.body.duration),
        date: new Date(req.body.date).toDateString() !== 'Invalid Date' ? new Date(req.body.date).toDateString() : new Date().toDateString()
      });
      console.log("ACTION COMPLETED");
    })
    .catch(error => {
      console.log("Couldn't update for some reason, here is the error message:");
      console.log(error);
      res.send('Having trouble here...');
    });
});

app.get('/api/users/:_id/logs', function(req, res) {
  console.log(`ACTION: Getting user log of user ${req.params._id}`);

  console.log(req.query.from, req.query.to, req.query.limit);
  Log.findOne({ _id: req.params._id })
     .then(data => {
      console.log("Data found for this user. Here is the data:");
      
      if (req.query.from === undefined && req.query.to === undefined && req.query.limit === undefined) {
        res.json({
          _id: data._id,
          username: data.username,
          count: data.count,
          log: data.log
        });
        console.log(data.log[0].date);
        console.log(data);
      } else {
        let fullLog = data.log;
        let fromDate = !isNaN(Date.parse(req.query.from)) ? Date.parse(req.query.from) : -8640000000000000;
        let toDate = !isNaN(Date.parse(req.query.to)) ? Date.parse(req.query.to) : 8640000000000000;
        let logLimit = req.query.limit || 4294967295;
        console.log(fromDate, toDate);

        let newLog = fullLog.sort((a, b) => {
          let dateA = new Date(a.date).getTime();
          let dateB = new Date(b.date).getTime();

          if (dateA < dateB) {
            return -1;
          } else if (dateA > dateB) {
            return 1;
          } else {
            return 0;
          }
        }).filter(obj => new Date(obj.date) > new Date(fromDate))
        .filter(obj => new Date(obj.date) < new Date(toDate))
        .filter((obj, index) => index < logLimit)
        .map(obj => { 
          return { duration: obj.duration, description: obj.description, date: obj.date };
        });
        console.log({
          _id: data._id,
          username: data.username,
          count: data.count,
          log: newLog
        });
        res.json({
          _id: data._id,
          username: data.username,
          count: data.count,
          log: newLog
        });
      }
      console.log("ACTION COMPLETED");
     })
     .catch(error => {
      console.log("Couldn't update for some reason, here is the error message:");
      console.log(error);
      res.send('Having trouble here...');
     });
});
/*

STEPS:

a. POST /api/users (form data is username) -> new user: { username: "username", _id: "..." } -> object
b. GET /api/users -> list of user objects in an array
c. POST /api/users/:_id/exercises (form data is description, duration, [optional; if not supplied, use today's] date) -> { username: "fcc_test", description: "test", duration: 60, date: "Mon Jan 01 1990", _id: "5fb5853f734231456ccb3b05" }
d. GET /api/users/:_id/logs -> { username: "fcc_test", count: 1, _id: "5fb5853f734231456ccb3b05", log: [{ description: "test", duration: 60, date: "Mon Jan 01 1990", }] }
e. GET /api/users/:_id/logs[from][to][limit] -> part of any log of any user. from and to are in yyyy-mm-dd format, limit is an integer of how many logs to send back

1. Set up mongoose. DONE
2. Deal with a. DONE
3. Deal with b. DONE
4. Deal with c. DONE
5. Deal with d. DONE
6. Deal with e. DONE

*/



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
