/*jslint node: true */
'use strict';
require('path');
require('http').Server(app);
require('arraybuffer-to-buffer');

var constant = require('../share/const.js');
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

	res.command = op;
	for (var m in constant.PACK[op]) {
		switch (constant.PACK[op][m]) {
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
	for (var m in constant.PACK[op]) {
		switch(constant.PACK[op][m]) {
			case 'Uint8':
				cnt += 1;
				break;
			case 'Int8':
				cnt += 1;
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
	for (m in constant.PACK[op]) {
		switch(constant.PACK[op][m]) {
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
	socket.send(encrypt({
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
	socket.send(encrypt({
		command: constant.COMMAND_TYPE.INIT,
		id: player.id,
		x: player.x,
		y: player.y
	}))

	// socket.send(toBuffer(buffer), {binary: true}, function ack(error) {
	// 	console.log(error);
	// });

  	socket.on('message', function (mess) {
  		var data = decrypt(mess);
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