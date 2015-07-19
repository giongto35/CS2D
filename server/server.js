/*jslint node: true */
'use strict';
require('path');
require('http').Server(app);
require('arraybuffer-to-buffer');

var constant = require('../share/const.js');
var coding = require('../share/coding.js');
var gameObject = require('./gameObject.js');
var express = require('express');
var app = express();
var webSocketServer = require('ws').Server;
var socketServer = new webSocketServer({port: 3030});
var fs = require('fs');
var configFilePath = 'server/config.yml';
var curr_id = 0;

// function loadConfig(configFilePath) {
// 	if (!fs.existsSync(configFilePath)) {
// 		console.log("Config file not found!");
// 		return;
// 	}

// 	return {
// 		speed: config.speed
// 	};	
// }

// var config = loadConfig(configFilePath)

var bulletConfig = {
	speed: 1
};

var playerConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 20,
    defaultColor: 0x00FF00
};

var players = [];
var bullets = [];
var sockets = [];

console.log('Listening on port 3030 ...');

function movePlayer(player, d) {
	player.x += constant.DIR[d].x;
	player.y += constant.DIR[d].y;
	for (var iPlayer in players) {
		if (players[iPlayer] !== player && checkCollision(player, players[iPlayer], 2 * playerConfig.defaultSize)) {
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
	var dx = bulletConfig.speed * Math.sin(deg);
	var dy = bulletConfig.speed * Math.cos(deg);
	var date = new Date();
	var stime = date.getTime() % 100000;
	bullets.push(new gameObject.Bullet(data.id, stime, data.x1, data.y1, dx, dy));
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
	console.log('A user connected. Assigning UserID...');

	//send current players
	for (var idx in players) {
		// console.log(players[idx]);
		var player = players[idx];
		socket.send(coding.encrypt({
			command: constant.COMMAND_TYPE.INIT,
			id: player.id,
			x: player.x,
			y: player.y,
			main: 0
		}));
	}

	var player = new gameObject.Player(curr_id++, 10, 10, socket);
	players.push(player);
	
	socket.send(coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		id: player.id,
		x: player.x,
		y: player.y,
		main: 1
	}));

	socketServer.sendOther(socket, coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		id: player.id,
		x: player.x,
		y: player.y,
		main: 0
	}));

  	socket.on('message', function (mess) {
  		var data = coding.decrypt(mess);
		if (data.command == constant.COMMAND_TYPE.KEYBOARD) {
			processKeyboardEvent(socketServer, socket, data);
		}
		if (data.command == constant.COMMAND_TYPE.MOUSE) {
			processMouseEvent(socketServer, socket, data);
		}
 	});
	// socket.emit('welcome', encrypt(PlayerSettings));


	socket.on('close', function () {
		console.log(player.id + ' disconnected');
		players.splice(findIndex(players, player.id), 1);
		socketServer.sendOther(socket, coding.encrypt({
			command: constant.COMMAND_TYPE.DESTROY,
			id: player.id
		}));
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
	return checkCollision(bullet, player, playerConfig.defaultSize);
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
	// console.log(bullets.length);
	for (var i = bullets.length - 1; i >= 0; i--) {
		var bullet = bullets[i];
		if (bullet.invalid()) {
			bullets.splice(i, 1);
		}
	}
}

setInterval(gameLoop, 1000 / 60);