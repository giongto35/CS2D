/*jslint node: true */
'use strict';
var path = require('path');

var constant = require('../share/const.js');
var coding = require('../share/coding.js');
var gameObject = require('./gameObject.js');
var express = require('express');
var portNum = Number(process.env.PORT || 3030);
var app = express();
var http = require('http').Server(app);
var webSocketServer = require('ws').Server;
var fs = require('fs');
var configFilePath = 'server/config.yml';
var curr_id = 0;


var players = [];
var bullets = [];
var sockets = [];
var tiles = [];
var blocks = [];

function LOG(message) {
	console.log(message);
}


app.use(express.static(__dirname + '/../client'));

app.get('/share/const.js', function(request, response) {
	response.sendFile(path.resolve(__dirname + '/../share/const.js'));
});

app.get('/share/coding.js', function(request, response) {
	response.sendFile(path.resolve(__dirname + '/../share/coding.js'));
});

http.listen(portNum, function() {
	LOG('Listening on ' + portNum + ' ...');
});

var socketServer = new webSocketServer({server: http});

//setup tiles
setupGameObject();

function setupGameObject() {
	var tiles = new Array(Math.trunc(constant.GAME_HEIGHT / constant.BLOCK_SIZE) + 1);
	for(var i = 0; i < tiles.length; i++) {
    	tiles[i] = new Array(Math.trunc(constant.GAME_HEIGHT / constant.BLOCK_SIZE) + 1);
	}
}

function inField(x, y, size) {
	return x >= size && 
		x <= constant.GAME_WIDTH - size &&
		y >= size &&
		y <= constant.GAME_HEIGHT - size
}

function movePlayer(player, d) {
	player.x += constant.DIR[d].x * constant.PLAYER_CONFIG.SPEED;
	player.y += constant.DIR[d].y * constant.PLAYER_CONFIG.SPEED;

	if (!inField(player.x, player.y, constant.PLAYER_CONFIG.DEFAULT_SIZE)) {
		player.x -= constant.DIR[d].x * constant.PLAYER_CONFIG.SPEED;
		player.y -= constant.DIR[d].y * constant.PLAYER_CONFIG.SPEED;
		return;
	}
	
	for (var iPlayer in players) {
		if (players[iPlayer] !== player && checkCollision(player, players[iPlayer], 2 * constant.PLAYER_CONFIG.DEFAULT_SIZE)) {
			player.x -= constant.DIR[d].x * constant.PLAYER_CONFIG.SPEED;
			player.y -= constant.DIR[d].y * constant.PLAYER_CONFIG.SPEED;
			return;
		}
	}

	for (var iBlock in blocks) {
		var block = blocks[iBlock];
		if (checkCirRectCollision(
			{x: player.x, y: player.y, radius: constant.PLAYER_CONFIG.DEFAULT_SIZE}, 
			{x1: block.x, y1: block.y, x2: block.x + constant.BLOCK_SIZE, y2: block.y + constant.BLOCK_SIZE})) {
			player.x -= constant.DIR[d].x * constant.PLAYER_CONFIG.SPEED;
			player.y -= constant.DIR[d].y * constant.PLAYER_CONFIG.SPEED;
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

function processInitEvent(socketServer, socket, data) {
	//send current players
	LOG('INFO: A player connected');
	sendCurrentState(socket);

	LOG('INFO: Sent INIT package for existing sockets');
	var player = new gameObject.Player(curr_id++, data.name, 60, 60, 100, socket);
	players.push(player);
	
	socket.send(coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		name: player.name,
		id: player.id,
		x: player.x,
		y: player.y,
		health: player.health,
		main: 1
	}));
	LOG('INFO: Sent INIT package to initialize socket ' + player.id);

	socketServer.sendOther(socket, coding.encrypt({
		command: constant.COMMAND_TYPE.INIT,
		name: player.name,
		id: player.id,
		x: player.x,
		y: player.y,
		health: player.health,
		main: 0
	}));
	LOG('INFO: Sent INIT package to all sockets except socket ' + player.id);
}

function processMouseEvent(socketServer, socket, data) {
	var deg = Math.atan2(data.x2 - data.x1, data.y2 - data.y1);
	var dx = constant.BULLET_CONFIG.SPEED * Math.sin(deg);
	var dy = constant.BULLET_CONFIG.SPEED * Math.cos(deg);
	var stime = Date.now() % 100000;
	var lagTime = stime - data.stime;
	stime = (stime + lagTime) % 100000; //lag compensate
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
	var moving = false;
	if (data.key == constant.KEY_LEFT || data.key == constant.KEY_A) {
		movePlayer(player, 0);
	}		
	if (data.key == constant.KEY_UP || data.key == constant.KEY_W) {
		movePlayer(player, 1);
	}
	if (data.key == constant.KEY_RIGHT || data.key == constant.KEY_D) {
		movePlayer(player, 2);
	}
	if (data.key == constant.KEY_DOWN || data.key == constant.KEY_S) {
		movePlayer(player, 3);
	}
	socketServer.broadcast(coding.encrypt({
		command: constant.COMMAND_TYPE.UPDATE, 
		id: player.id, 
		x: player.x, 
		y: player.y
	}));	
}

function processPingEvent(socketServer, socket, data) {
	socket.send(coding.encrypt({command: constant.COMMAND_TYPE.PING, stime: data.stime}));
}

function processBuildEvent(socketServer, socket, data) {
	blocks.push(new gameObject.Block(data.x * constant.BLOCK_SIZE, data.y * constant.BLOCK_SIZE));
	socketServer.broadcast(coding.encrypt({command: constant.COMMAND_TYPE.MOUSEBUILD, x: data.x, y: data.y}));
}

function sendCurrentState(socket) {
	for (var iPlayer in players) {
		var player = players[iPlayer];
		socket.send(coding.encrypt({
			command: constant.COMMAND_TYPE.INIT,
			id: player.id,
			x: player.x,
			y: player.y,
			health: player.health,
			main: 0
		}));
	}

	for (var iBlock in blocks) {
		var block = blocks[iBlock];
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.MOUSEBUILD, x: block.x / constant.BLOCK_SIZE, y: block.y / constant.BLOCK_SIZE}));
	}
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

	LOG('A socket connected');

  	socket.on('message', function (mess) {
  		var data = coding.decrypt(mess);
		LOG('INFO: Received a package');
		LOG(data);
		if (data.command == constant.COMMAND_TYPE.INIT) {
			LOG('INFO: Received INIT package');
			processInitEvent(socketServer, socket, data);
			LOG('INFO: Processed INIT event');			
		}
		if (data.command == constant.COMMAND_TYPE.KEYBOARD) {
			LOG('INFO: Received KEYBOARD package');
			processKeyboardEvent(socketServer, socket, data);
			LOG('INFO: Processed KEYBOARD event');
		}
		if (data.command == constant.COMMAND_TYPE.MOUSE) {
			LOG('INFO: Received MOUSE package');
			processMouseEvent(socketServer, socket, data);
			LOG('INFO: Processed MOUSE event');
		}
		if (data.command == constant.COMMAND_TYPE.PING) {
			LOG('INFO: Received PING package');
			processPingEvent(socketServer, socket, data);
			LOG('INFO: Processed PING event');			
		}
		if (data.command == constant.COMMAND_TYPE.MOUSEBUILD) {
			LOG('INFO: Received MOUSEBUILD package');
			processBuildEvent(socketServer, socket, data);
			LOG('INFO: Processed MOUSEBUILD event');			
		}
 	});
	// socket.emit('welcome', encrypt(PlayerSettings));


	socket.on('close', function () {
		LOG('INFO: ' + player.id + ' disconnected');
		console.log(players);
		players.splice(findIndex(players, player.id), 1);
		socketServer.sendOther(socket, coding.encrypt({
			command: constant.COMMAND_TYPE.DESTROY,
			id: player.id
		}));
		LOG('INFO: Sent DESTROY package to all sockets except socket ' + player.id);
		console.log(players);
	});

	// socket.on('ping', function () {
	// 	socket.emit('pong');
	// })

	// })
});

function dist(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function checkCirRectCollision(cir, rect) {
	if (rect.x1 <= cir.x && cir.x <= rect.x2 && rect.y1 <= cir.y && cir.y <= rect.y2) {
		return true;
	}
	var xnear = Math.max(Math.min(cir.x, rect.x2), rect.x1);
	var ynear = Math.max(Math.min(cir.y, rect.y2), rect.y1);
	if (dist(cir.x, cir.y, xnear, ynear) <= cir.radius) {
		return true;
	}
	return false;
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
				player.health -= 20; // amount of HP will be calculated based on the distance with the center
				socketServer.broadcast(coding.encrypt({
					command: constant.COMMAND_TYPE.HPCHANGE,
					id: player.id,
					health: player.health
				}));
				if (player.health <= 0) {
					// players.splice(iPlayer, 1);
					player.socket.send(coding.encrypt({
						command: constant.COMMAND_TYPE.DESTROY,
						id: player.id
					}));		
					console.log(players);
					break;
				}
			}
		}
	}	

	//update Object
	// LOG(bullets.length);
	for (var i = bullets.length - 1; i >= 0; i--) {
		var bullet = bullets[i];
		if (bullet.invalid()) {
			bullets.splice(i, 1);
			continue;
		}
		for (var iBlock in blocks) {
			var block = blocks[iBlock];
			if (checkCirRectCollision(
				{x: bullet.x, y: bullet.y, radius: 1}, 
				{x1: block.x, y1: block.y, x2: block.x + constant.BLOCK_SIZE, y2: block.y + constant.BLOCK_SIZE})) {
				console.log("HIT BLOCK");
				bullets.splice(i, 1);
				break;
			}
		}
	}
}

setInterval(gameLoop, 1000 / 30);

