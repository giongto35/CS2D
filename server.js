/*jslint node: true */
'use strict';
require('path');
require('http').Server(app);
require('arraybuffer-to-buffer');

var express = require('express');
var app = express();
var WebSocketServer = require('ws').Server;
var socketServer = new WebSocketServer({port: 3030});
var fs = require('fs');
var configFilePath = 'server/config.yml';
var dir = [{x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}];
var curr_id = 0;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;

//make register function for command
var COMMAND_TYPE = {init: 0, keyboard: 1, mouse: 2, update: 3};
var pack = [
	{id: 'Int32', x: 'Int32', y: 'Int32'},
	{key: 'Uint8'}, 
	{x: 'Float32', y: 'Float32'},
	{x: 'Float32', y: 'Float32'}
];

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
var dy = [-1, 0, 1, 0];
var dx = [0, -1, 0, 1];

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}

function toBuffer(ab) {
    var buffer = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

function decrypt(ab) {
	//keyboard
	var res = {};
	var dv = new DataView(toArrayBuffer(ab));
	var op = dv.getUint8(0);
	var offset = 1;

	res['command'] = op;
	for (var m in pack[op]) {
		switch (pack[op][m]) {
			case 'Uint8':
				res[m] = dv.getUint8(offset);
				offset += 1;
				break;
			case 'Int8':
				res[m] = dv.getInt8(offset);
				offset += 1;
				break;
			case 'Int16':
				res[m] = dv.getInt16(offset);
				offset += 2;
				break;
			case 'Int32':
				res[m] = dv.getInt32(offset);
				offset += 4;
				break;
			case 'Float32':
				res[m] = dv.getFloat32(offset);
				offset += 4;
				break;
		}
	}
	return res;
}

function encrypt(data) {
	var cnt = 1; //Opcode
	var op = data.command;
	for (var m in pack[op]) {
		switch(pack[op][m]) {
			case 'Uint8':
				cnt += 1;
				break;
			case 'Int8':
				cnt += 1
				break;
			case 'Int16':
				cnt += 2;
				break;
			case 'Int32':
				cnt += 4;
				break;
			case 'Float32':
				cnt += 4;
				break;
		}		
	}
	var res = new ArrayBuffer(cnt);
	var dv = new DataView(res);
	var offset = 1;
	dv.setUint8(0, op);
	for (var m in pack[op]) {
		switch(pack[op][m]) {
			case 'Uint8':
				dv.setUint8(offset, data[m]);
				offset += 1;
				break;
			case 'Int8':
				dv.setInt8(offset, data[m]);
				offset += 1;
				break;
			case 'Int16':
				dv.setInt16(offset, data[m]);
				offset += 2;
				break;
			case 'Int32':
				dv.setInt32(offset, data[m]);
				offset += 4;
				break;
			case 'Float32':
				dv.setFloat32(offset, data[m]);
				offset += 4;
				break;
		}
	}
	return toBuffer(res);
}

console.log('Listening on port 3030 ...');

function movePlayer(player, d) {
	player.x += dir[d].x;
	player.y += dir[d].y;
}

function processShootingEvent(socket, currentPlayer, data) {

}

function processKeyboardEvent(socket, currentPlayer, data) {
	if (data.key == KEY_UP || data.key == KEY_DOWN || data.key == KEY_LEFT || data.key == KEY_RIGHT) {
		movePlayer(currentPlayer, data.key - KEY_LEFT);
	}
	socket.send(encrypt({
		command: COMMAND_TYPE.update, 
		id: currentPlayer.id, 
		x: currentPlayer.x, 
		y: currentPlayer.y
	}));	
}

socketServer.on('connection', function connection(socket) {
	console.log('A user connected. Assigning UserID...');

	var currentPlayer = {
		id: ++curr_id,
		x: 0,
		y: 0
	}

	socket.send(encrypt({
		command: COMMAND_TYPE.init, 
		id: currentPlayer.id, 
		x: currentPlayer.x, 
		y: currentPlayer.y
	}))	

	// socket.send(toBuffer(buffer), {binary: true}, function ack(error) {
	// 	console.log(error);
	// });

  	socket.on('message', function (mess) {
  		data = decrypt(mess);
		console.log(data);
		if (data.command == COMMAND_TYPE.keyboard) {
			processKeyboardEvent(socket, currentPlayer, data);
		}
		if (data.command == COMMAND_TYPE.mouse) {
			processShootingEvent(socket, currentPlayer, data);
		}
 	});
	// socket.emit('welcome', encrypt(PlayerSettings));

	socket.on('playerConnected', function (player) {
	})

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