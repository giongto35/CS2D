/*jslint node: true */
'use strict';
var path = require('path');

var constant = require('../share/const.js');
var coding = require('../share/coding.js');
var gameObject = require('./gameObject.js');
var express = require('express');
var portNum = (process.env.PORT || 3030);
var ipaddress = process.env.IP || '127.0.0.1';
var app = express();
var http = require('http').Server(app);
var webSocketServer = require('ws').Server;
var fs = require('fs');
var configFilePath = 'server/config.yml';
var curr_id = 0;


var players = [];
var bullets = [];
var sockets = [];

function LOG(message) {
	console.log(message);
}


// app.use(express.static(__dirname + '/../client'));
// views is directory for all template files

// app.set('views', __dirname + '/../client');
app.use(express.static(__dirname + '/../client'));

// app.get('/share/const.js', function(request, response) {
// 	response.sendFile(path.resolve(__dirname + '/../share/const.js'));
// });

// app.get('/share/coding.js', function(request, response) {
// 	response.sendFile(path.resolve(__dirname + '/../share/coding.js'));
// });

http.listen( portNum, ipaddress, function() {
	LOG('Listening on ' + ipaddress + ':' + portNum + ' ...');
});

// var socketServer = new webSocketServer({server: http});
var socketServer = new webSocketServer({port: portNum});


function movePlayer(player, d) {
	player.x += constant.DIR[d].x;
	player.y += constant.DIR[d].y;
	for (var iPlayer in players) {
		if (players[iPlayer] !== player && checkCollision(player, players[iPlayer], 2 * constant.PLAYER_CONFIG.DEFAULT_SIZE)) {
			player.x -= constant.DIR[d].x;
			player.y -= constant.DIR[d].y;
			return;
		}
	}
}

function findIndex(arr, id) {
    var len = arr.length;
    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }
    return -1;
}

function processMouseEvent(socketServer, socket, data) {
	var deg = Math.atan2(data.x2 - data.x1, data.y2 - data.y1);
	var dx = constant.BULLET_CONFIG.SPEED * Math.sin(deg);
	var dy = constant.BULLET_CONFIG.SPEED * Math.cos(deg);
	var date = new Date();
	var stime = date.getTime() % 100000;
	bullets.push(new gameObject.Bullet(data.id, stime, data.x1, data.y1, dx, dy));

	LOG('INFO: Broadcast SHOOT package');
	LOG({command: constant.COMMAND_TYPE.SHOOT, id: data.id, stime: stime, x1: data.x1, y1: data.y1, dx: dx, dy: dy});

	socketServer.broadcast(coding.encrypt({
		command: constant.COMMAND_TYPE.SHOOT, 
		id: data.id,
		stime: stime,
		x1: data.x1, 
		y1: data.y1,
		dx: dx,
		dy: dy
	}));	
}

function processKeyboardEvent(socketServer, socket, data) {
	var player = players[findIndex(players, data.id)];
	if (data.key == constant.KEY_UP || data.key == constant.KEY_DOWN || data.key == constant.KEY_LEFT || data.key == constant.KEY_RIGHT) {
		movePlayer(player, data.key - constant.KEY_LEFT);
	}
	socketServer.broadcast(coding.encrypt({
		command: constant.COMMAND_TYPE.UPDATE, 
		id: player.id, 
		x: player.x, 
		y: player.y
	}));	
}

socketServer.broadcast = function broadcast(data) {
	socketServer.clients.forEach(function each(client) {
		client.send(data);
	});
};

socketServer.sendOther = function sendOther(socket, data) {
	socketServer.clients.forEach(function each(client) {
  		if (socket !== client) {
    		client.send(data);
		}
	});	
};

socketServer.on('connection', function connection(socket) {
	LOG('A user connected. Assigning UserID...');

	//send current players
	LOG('INFO: A player connected');
	for (var idx in players) {
		// LOG(players[idx]);
		var player = players[idx];
		socket.send(coding.encrypt({
			command: constant.COMMAND_TYPE.INIT,
			id: player.id,
			x: player.x,
			y: player.y,
			main: 0
		}));
	}
	LOG('INFO: Sent INIT package for existing sockets');

	var player = new gameObject.Player(curr_id++, 10, 10, socket);
	players.push(player);
	
	socket.send(coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		id: player.id,
		x: player.x,
		y: player.y,
		main: 1
	}));
	LOG('INFO: Sent INIT package to initialize socket ' + player.id);

	socketServer.sendOther(socket, coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		id: player.id,
		x: player.x,
		y: player.y,
		main: 0
	}));
	LOG('INFO: Sent INIT package to all sockets except socket ' + player.id);

  	socket.on('message', function (mess) {
  		var data = coding.decrypt(mess);
		LOG('INFO: Received a package');
		LOG(data);
		if (data.command == constant.COMMAND_TYPE.KEYBOARD) {
			LOG('INFO: Received KEYBOARD package');
			processKeyboardEvent(socketServer, socket, data);
			LOG('INFO: Processed Keyboard event');
		}
		if (data.command == constant.COMMAND_TYPE.MOUSE) {
			LOG('INFO: Received MOUSE package');
			processMouseEvent(socketServer, socket, data);
			LOG('INFO: Processed Mouse event');
		}
 	});
	// socket.emit('welcome', encrypt(PlayerSettings));


	socket.on('close', function () {
		LOG('INFO: ' + player.id + ' disconnected');
		players.splice(findIndex(players, player.id), 1);
		socketServer.sendOther(socket, coding.encrypt({
			command: constant.COMMAND_TYPE.DESTROY,
			id: player.id
		}));
		LOG('INFO: Sent DESTROY package to all sockets except socket ' + player.id);
	});

	// socket.on('ping', function () {
	// 	socket.emit('pong');
	// })

	// })
});

function dist(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function checkCollision(obj1, obj2, lim) {
	return (dist(obj1.x, obj1.y, obj2.x, obj2.y) < lim);
}

function checkHit(bullet, player) {
	bullet.update();
	return checkCollision(bullet, player, constant.PLAYER_CONFIG.DEFAULT_SIZE);
}

function gameLoop() {
	for (var iPlayer = players.length - 1; iPlayer >= 0; iPlayer--) {
		var player = players[iPlayer];
		for (var iBullet in bullets) {
			var bullet = bullets[iBullet];
			if (bullet.playerId != player.id && checkHit(bullet, player)) {
				// players.splice(iPlayer, 1);
				player.socket.send(coding.encrypt({
					command: constant.COMMAND_TYPE.DESTROY,
					id: player.id
				}));
				break;
			}
		}
	}	

	//update Object
	// LOG(bullets.length);
	for (var i = bullets.length - 1; i >= 0; i--) {
		var bullet = bullets[i];
		if (bullet.invalid()) {
			bullets.splice(i, 1);
		}
	}
}

setInterval(gameLoop, 1000 / 60);

