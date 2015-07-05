var graphicStage = null;
var graphicRenderer = null;

var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var gameWidth = screenWidth ;
var gameHeight = screenHeight ;
var xoffset = -gameWidth;
var yoffset = -gameHeight;

var bulletConfig = {
	speed: 10
}

var playerConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var enemyConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var socket = new WebSocket('ws://127.0.0.1:3030');
socket.binaryType = 'arraybuffer';

//make register function for command

var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;

var bulletArr = [];
var gameObj = [];
var Obj = [];
var player = new Object(); //create by new player
var gameInput = {mouse: {down: false, x: 0, y: 0}, keyboard: {37: false, 38: false, 39: false, 40: false}};

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
}

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

function shootBullet(player, x1, y1, x2, y2) {
	date = new Date();
	if (date.getTime() - player.shotTime > player.reloadInterval) {
		bulletArr.push(new createBullet(x1, y1, x2, y2));	
		player.shotTime = date.getTime();
	}
}

function updatePosition(data) {
	player.x = data.x;
	player.y = data.y;
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
		// console.log(data);
		switch (data.command) {
			case constant.COMMAND_TYPE.INIT:
				//construct player
				player = new createPlayer(data.id, data.x, data.y);
				break;
			case constant.COMMAND_TYPE.UPDATE:
				updatePosition(data);
				break;
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

	var canvas = document.getElementById("myCanvas");
    graphicRenderer = PIXI.autoDetectRenderer(screenWidth, screenHeight, canvas, false, true);	
    document.body.appendChild(graphicRenderer.view);
	graphicRenderer.view.style.position = "absolute";
	graphicRenderer.view.style.top = "0px";
	graphicRenderer.view.style.left = "0px";
	graphicRenderer.backgroundColor = 0xFFFFFF;
    graphicStage = new PIXI.Container();
	requestAnimationFrame(animate);
}

function updateGameState() {
	//update by game input
	for (var m in gameInput.keyboard) {
		if (gameInput.keyboard[m]) {
			socket.send(coding.encrypt({command: constant.COMMAND_TYPE.KEYBOARD, id: player.id, key: m}));
		}
		if (gameInput.mouse.down) {
			shootBullet(player, player.x, player.y, gameInput.mouse.x, gameInput.mouse.y);
			socket.send(coding.encrypt({command: constant.COMMAND_TYPE.SHOOT, x1: player.x, y1: player.y, x2: gameInput.mouse.x, y2: gameInput.mouse.y}));
		}
	}

	//update Object
	for (var i = gameObj.length - 1; i >= 0; i--) {
		obj = gameObj[i];
		//obj is no longer available because deleted in invalid
		if (obj.update != undefined) {
			obj.update();
		}
		if (obj.invalid()) {
			obj.destroy();
			gameObj.splice(i, 1);
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

function drawCircle(centerX, centerY, radius) {
	var circle = new PIXI.Graphics();
    circle.lineStyle ( 2, 0x000100,  1);
	circle.beginFill(0xFF66FF);
	circle.drawCircle(centerX, centerY, radius);	
	return circle;
}

//use as new createPlayer. If not this will be treated as function
function createPlayer(id, x, y, reloadInterval) {
	this.graphic = drawCircle(0, 0, playerConfig.defaultSize);
	this.id = id != undefined ? id : -1;
	this.x = x != undefined ? x : 0;
	this.y = y != undefined ? y : 0;
	this.reloadInterval = reloadInterval != undefined ? reloadInterval : 10;
	this.shotTime = -1000000;

	graphicStage.addChild(this.graphic);
	gameObj.push(this);

	this.updateGraphic = function() {
		this.graphic.x = this.x;
		this.graphic.y = this.y;
	}

	this.invalid = function() {

	}

	this.update = function() {
		this.updateGraphic();
	}

}

function createBullet(x1, y1, x2, y2) {
	this.graphic = drawCircle(0, 0, 1);
	this.speed = bulletConfig.speed;
	this.x = x1;
	this.y = y1;

    // graphicObj.push(this);
	graphicStage.addChild(this.graphic);
	gameObj.push(this);
    var deg = Math.atan2(y2 - y1, x2 - x1);
    var deltaY = this.speed * Math.sin(deg);
    var deltaX = this.speed * Math.cos(deg);

    this.updateGraphic = function() {
    	this.graphic.x = this.x;
    	this.graphic.y = this.y;
    }

	this.invalid = function() {
		return (this.x < 0 || this.x > gameWidth || this.y < 0 || this.y > gameHeight);
	}

	this.update = function() {
		this.x = this.x + deltaX;
		this.y = this.y + deltaY;
		this.graphic.x = this.x;
		this.graphic.y = this.y;
		this.updateGraphic();
	}

	this.destroy = function() {
		this.graphic.clear();
		delete this.graphic;
		graphicStage.removeChild(this.graphic);
	}
}

setupSocket(socket);
setupGraphic();

//Graphic
// animate();
