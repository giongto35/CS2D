'use strict';

var graphicStage = null;
var graphicRenderer = null;

var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var xoffset = -constant.GAME_WIDTH;
var yoffset = -constant.GAME_HEIGHT;

var socket = new WebSocket('ws://127.0.0.1:3030');
socket.binaryType = 'arraybuffer';

//make register function for command

var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;

var bulletArr = [];
var gameObj = [];
var player = {}; //create by new player
var gameInput = {mouse: {down: false, x: 0, y: 0}, keyboard: {37: false, 38: false, 39: false, 40: false}};
var players = [];

window.onload = function() {
	window.addEventListener('keydown', function (e) {
		keyDownEvent(e);
	}, true);

	window.addEventListener('keyup', function (e) {
		keyUpEvent(e);
	}, true);

	window.addEventListener('mousedown', function (e) {
		mouseDownEvent(e);
	}, false);

	window.addEventListener('mousemove', function (e) {
		mouseMoveEvent(e);
	}, false);

	window.addEventListener('mouseup', function (e) {
		mouseUpEvent(e);
	}, false);
};

function keyDownEvent(e) {
	var key = e.which || e.keyCode;
	gameInput.keyboard[key] = true;
}

function keyUpEvent(e) {
	var key = e.which || e.keyCode;
	gameInput.keyboard[key] = false;
}

function mouseDownEvent(e) {
	gameInput.mouse.down = true;
}

function mouseUpEvent(e) {
	gameInput.mouse.down = false;
}

function mouseMoveEvent(e) {
	gameInput.mouse.x = e.clientX;
	gameInput.mouse.y = e.clientY;
}

function shootBullet(data) {
	bulletArr.push(new Bullet(data.stime, data.x1, data.y1, data.dx, data.dy));	
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

function updatePosition(data) {
	var player = players[findIndex(players, data.id)]; 
	player.x = data.x;
	player.y = data.y;
}

function initPlayer(data) {
	var tempPlayer = new Player(data.id, data.x, data.y, data.main === 1);
	if (data.main == 1) {
		player = tempPlayer;
	} 
	players.push(tempPlayer);					
}

function removePlayer(data) {
	if (data.id == player.id) {
		// player.destroy();
		socket.close();
	}
	var idx = findIndex(players, data.id);
	players[idx].destroy();
	players.splice(idx, 1);
}

function setupSocket(socket) {
	// socket.on('pong', function () {
	// 	var latency = Date.now() - startPingTime;
	// 	console.log('Latency: ' + latency + 'ms');
	// })

	socket.onopen = function (event) { 

	}

	socket.onmessage = function (event) {
		var data = coding.decrypt(event.data);
		switch (data.command) {
			case constant.COMMAND_TYPE.INIT:
				initPlayer(data);
				break;
			case constant.COMMAND_TYPE.UPDATE:
				updatePosition(data);
				break;
			case constant.COMMAND_TYPE.DESTROY:
				removePlayer(data);
				break;
			case constant.COMMAND_TYPE.SHOOT:
				shootBullet(data);
		}
  	}

}

function setupGraphic() {
	window.requestAnimFrame = (function(){
	  return  window.requestAnimationFrame       ||
	          window.webkitRequestAnimationFrame ||
	          window.mozRequestAnimationFrame    ||
	          function( callback ){
	            window.setTimeout(callback, 1000 / 60);
	          };
	})();

	// var canvas = document.getElementById("myCanvas");
    graphicRenderer = PIXI.autoDetectRenderer(screenWidth, screenHeight, {antialias: true});	
    document.body.appendChild(graphicRenderer.view);
	graphicRenderer.view.style.position = 'absolute';
	graphicRenderer.view.style.top = '0px';
	graphicRenderer.view.style.left = '0px';
	graphicRenderer.backgroundColor = 0xFFFFFF;
    graphicStage = new PIXI.Container();
	requestAnimationFrame(animate);
}

function sendMouseEvent(id, x1, y1, x2, y2) {
	var date = new Date();
	if (date.getTime() - player.shotTime > player.reloadInterval) {
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.MOUSE, id: id, x1: x1, y1: y1, x2: x2, y2: y2}));
		player.shotTime = date;
	}
	// socket.send(coding.encrypt({command: constant.COMMAND_TYPE.SHOOT, id: player.id, stime: stime, x1: player.x, y1: player.y, dx: dx, dy: dy}));
}

function sendKeyboardEvent(id, m) {
	socket.send(coding.encrypt({command: constant.COMMAND_TYPE.KEYBOARD, id: id, key: m}));
}

function updateGameState() {
	//update by game input
	for (var m in gameInput.keyboard) {
		if (gameInput.keyboard[m]) {
			sendKeyboardEvent(player.id, m);
		}
	}
	if (gameInput.mouse.down) {
		sendMouseEvent(player.id, player.x, player.y, gameInput.mouse.x, gameInput.mouse.y);
	}

	//update Object
	for (var i = gameObj.length - 1; i >= 0; i--) {
		var obj = gameObj[i];
		//obj is no longer available because deleted in invalid
		if (obj.update !== undefined) {
			obj.update();
		}
		if (obj.invalid()) {
			obj.destroy();
		}
	}
}

function gameLoop() {
    updateGameState();
}

function animate() {
    requestAnimationFrame(animate);
    gameLoop();
    graphicRenderer.render(graphicStage);
}

function drawCircle(centerX, centerY, radius, color) {
	var circle = new PIXI.Graphics();
    circle.lineStyle ( 2, 0x000100,  1);
	circle.beginFill(color);
	circle.drawCircle(centerX, centerY, radius);	
	return circle;
}

function Player(id, x, y, mainChar, reloadInterval) {
	var color = mainChar === true ? constant.PLAYER_CONFIG.DEFAULT_COLOR : constant.ENEMY_CONFIG.DEFAULT_COLOR;
	this.graphic = drawCircle(0, 0, constant.PLAYER_CONFIG.DEFAULT_SIZE, color);
	this.id = id !== undefined ? id : -1;
	this.x = x !== undefined ? x : 0;
	this.y = y !== undefined ? y : 0;
	this.reloadInterval = reloadInterval !== undefined ? reloadInterval : 100;
	this.shotTime = -1000000;

	graphicStage.addChild(this.graphic);
	gameObj.push(this);

	this.updateGraphic = function() {
		this.graphic.x = this.x;
		this.graphic.y = this.y;
	};

	this.invalid = function() {

	};

	this.update = function() {
		this.updateGraphic();
	};

	this.destroy = function() {
		for (var iObj in gameObj) {
			if (gameObj[iObj] === this) {
				gameObj.splice(iObj, 1);
				break;
			}
		}
		this.graphic.clear();
		delete this.graphic;
		graphicStage.removeChild(this.graphic);
	};
}

function Bullet(stime, x1, y1, dx, dy) {
	this.graphic = drawCircle(0, 0, 1, 0x000000);
	this.sx = x1;
	this.sy = y1;
	this.x = x1;
	this.y = y1;
	this.dx = dx;
	this.dy = dy;
	this.stime = stime;

    // graphicObj.push(this);
	graphicStage.addChild(this.graphic);
	gameObj.push(this);

    this.updateGraphic = function() {
    	this.graphic.x = this.x;
    	this.graphic.y = this.y;
    };

	this.invalid = function() {
		this.update();
		return (this.x < 0 || this.x > constant.GAME_WIDTH || this.y < 0 || this.y > constant.GAME_HEIGHT);
	};

	this.update = function() {
		var date = new Date();
		var cur = date.getTime() % 100000;
		this.x = this.sx + this.dx * (cur - this.stime);
		this.y = this.sy + this.dy * (cur - this.stime);
		this.updateGraphic();
	};

	this.destroy = function() {
		for (var iObj in gameObj) {
			if (gameObj[iObj] === this) {
				gameObj.splice(iObj, 1);
				break;
			}
		}
		this.graphic.clear();
		delete this.graphic;
		graphicStage.removeChild(this.graphic);
	};
}

setupSocket(socket);
setupGraphic();

//Graphic
// animate();
