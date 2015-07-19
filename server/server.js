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
	speed: 1v
};

var players = [];
var sockets = [];

console.log('Listening on port 3030 ...');

function movePlayer(player, d) {
	player.x += constant.DIR[d].x;
	player.y += constant.DIR[d].y;
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

	var player = new gameObject.Player(curr_id++, 10, 10);
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
		console.log(findIndex(players, player.id) + ' disconnected');
		players.splice(findIndex(players, player.id));
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