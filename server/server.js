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
var WebSocketServer = require('ws').Server;
var socketServer = new WebSocketServer({port: 3030});
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

function processShootingEvent(socket, data) {
}

function processKeyboardEvent(socket, data) {
	var player = players[findIndex(players, data.id)];
	if (data.key == constant.KEY_UP || data.key == constant.KEY_DOWN || data.key == constant.KEY_LEFT || data.key == constant.KEY_RIGHT) {
		movePlayer(player, data.key - constant.KEY_LEFT);
	}
	socket.send(coding.encrypt({
		command: constant.COMMAND_TYPE.UPDATE, 
		id: player.id, 
		x: player.x, 
		y: player.y
	}));	
}

socketServer.on('connection', function connection(socket) {
	console.log('A user connected. Assigning UserID...');

	var player = new gameObject.Player(curr_id++, 10, 10);
	players.push(player);
	socket.send(coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		id: player.id,
		x: player.x,
		y: player.y
	}))

	// socket.send(toBuffer(buffer), {binary: true}, function ack(error) {
	// 	console.log(error);
	// });

  	socket.on('message', function (mess) {
  		var data = coding.decrypt(mess);
		if (data.command == constant.COMMAND_TYPE.KEYBOARD) {
			processKeyboardEvent(socket, data);
		}
		if (data.command == constant.COMMAND_TYPE.MOUSE) {
			processShootingEvent(socket, data);
		}
 	});
	// socket.emit('welcome', encrypt(PlayerSettings));

	socket.on('playerConnected', function (player) {
	});

	// socket.on('ping', function () {
	// 	socket.emit('pong');
	// })

	// socket.on('disconnect', function () {
	// 	socket.broadcast.emit(
	// 		'playerDisconnect',
	// 		encrypt({playerList: users, disconnectName: playerName})
	// 		)
	// })

	// socket.on('playerMove', function (data) {
	// 	command = decrypt(data);
	// 	if 

	// })
});