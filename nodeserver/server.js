var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var fs = require('fs');
var mysql = require('mysql');


var connection = mysql.createConnection(
    {
      host     : 'localhost',
	  port     : '3306',
      user     : 'root',
      password : 'root',
      database : 'users',
    }
);

connection.connect();
// Routes and io.on statement with listeners on 'connection'

/*
    localhost:4000 and localhost:4000/index.html will send the main page

    all assets and assets in sub-directories can be accessed by adding their pathing
        ex:localhost:4000/images/pandabear.png
*/

base_dir = __dirname.substr(0,__dirname.length-4);
app.use(express.static(base_dir));

var client = function(username,socket){
    this.username = username;
    this.id = socket.id;
}


var usersOn = [];//Array of everybody online, so the
var usersActive = [];//Users in lobby for multiplayer games

//When somebody connects, add these handlers
io.sockets.on('connection', function(socket) {
    //Check for existing session
    usersOn.forEach(function(item){
        if (item.id == socket.id){
            //resume Session
            console.log("magic");
        }
    });
    //Handle username/password validation, add to UsersOn/UsersActive
    socket.on('login', function(loginData) {
        var success = false;

        var usr  = mysql.escape(loginData.split(" ")[0]);
        var pw   = mysql.escape(loginData.split(" ")[1]);
        connection.query("SELECT * FROM userInfo WHERE Username = " + usr + " AND Password = MD5("+pw+")", function(err,rows){
            console.log(err);
            if(rows.length > 0){
              console.log(rows[0].ID);
              socket.emit('loginResponse', rows[0].Username);
            }
            else
              socket.emit('loginResponse','Invalid username/password');
            });
        });

    //Handle logging out and taking the user out of the user arrays
    socket.on('logout', function(username){
        console.log("got logout request!");
        var compareUser = new client(username, socket.id);
        var index = usersOn.indexOf(compareUser);
        if(index > -1){
            usersOn.splice(index, 1);
        }
		index = usersActive.indexOf(compareUser);
        if(index > -1){
            usersActive.splice(index, 1);
        }
        sendUsersActive();
    });

  socket.on('signUp', function(Username, Pass){
    var usr  = mysql.escape(Username);
    var pw   = mysql.escape(Pass);
    console.log(usr);
    console.log(pw);
    connection.query("Insert Into userInfo (id, Username, Password, Name, Email) Values (null, "+ usr +",md5("+ pw +"),"+ "null" +","+ "null" +");", function(err,rows){
          socket.emit('signupResponse',rows.insertId);
        });
    });

});

server.listen(4000);
console.log("app server readied");
io.listen(5000);
console.log("Web sockets readied");

function arrayify(file) {
    var fullFile = __dirname+"\\"+file;
    var readFile = fs.readFileSync(fullFile);
    var retArray = readFile.toString().split('\n');
    return retArray;
}
