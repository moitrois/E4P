const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Expose static public files
app.use(express.static(path.join(__dirname, 'public')));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json());

let admins = [];

///////////////////////////////////////////////////////////////////////
//        Server Configuration
///////////////////////////////////////////////////////////////////////

// Redirect http requests to https when in production
if (app.get('env') == 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`)
    } else {
      next();
    }
  });
};

///////////////////////////////////////////////////////////////////////
//        Routes
///////////////////////////////////////////////////////////////////////

app.get('/', function(req, res) {
	res.sendFile('index.html', {root: path.join(__dirname, 'public')});
});

app.get('/admin', function(req, res) {
	res.sendFile('admin.html', {root: path.join(__dirname, 'public')});
});

app.get('/login', function(req, res) {
  res.sendFile('login_page.html', {root: path.join(__dirname, 'public')});
});

app.post('/login', function(req, res) {
  // TODO add authentication to this route and remove the following print statements:
  console.log(req.body.username)
  console.log(req.body.password)

  res.send('success');
});

app.get('/help', function(req, res) {
  res.sendFile('help_page.html', {root: path.join(__dirname, 'public')});
});

app.post('/admin', function(req, res) {
  admins.push(req.body.admin);
});

///////////////////////////////////////////////////////////////////////
//        Sockets
///////////////////////////////////////////////////////////////////////

io.on('connection', (socket) => {  
  // PHASE I
  socket.on('user connect', () => {
    for (let admin of admins) {
      socket.broadcast.to(admin).emit('user waiting', socket.id);
    }
  }); 

  // PHASE II
  // Admin Accepts User:
  // 1. put admin in same room as user
  // 2. tell user we joined
  // 3. tell other admins to remove user from their lists
  socket.on('accept user', (user_room_id) => {
    // TODO what if user_room_id no longer exists
    socket.join(user_room_id);
    socket.broadcast.to(user_room_id).emit('admin matched');
    for (let admin of admins) {
      socket.broadcast.to(admin).emit('user matched', user_room_id);
    }
  });

  // PHASE III
  // recieve chat message from admin or user, and send it to a specific user's room
  socket.on('chat message', function(data) {
    // console.log(data.message);

    let message = data['message'];
    let reciever = data['room'];
    // console.log('reciever: ' + reciever);
    socket.broadcast.to(reciever).emit('chat message', {message: message, room: reciever});
  });

  // PHASE IV
  // User Disconnects:
  socket.on('disconnect', () => {
    // console.log(socket.id + ' DISCONNECTED')
    var user_room_id = socket.id;
    var room = io.sockets.adapter.rooms[user_room_id];
    if (room) {
      // room exists, either admin or user left in room, send disconnect
      socket.broadcast.to(user_room_id).emit('user disconnect', user_room_id);
    } else {
      // room DNE, no one else connected, user was pending
      // TODO what if admin disconnected first, dont need to send 'accept user'
      for (let admin of admins) {
        socket.broadcast.to(admin).emit('user matched', user_room_id);
      }
    }
    // Removes admin ID from admins array when an admin disconnects
    for (let i = 0; i < admins.length; i++) {
      if (admins[i] == user_room_id) {
        admins.splice(i, 1);
      }
    }
  });
});

server.listen(process.env.PORT || 3000, function() {
  	console.log('Node app is running on port 3000');
});

module.exports = app;
module.exports.admins = admins;
