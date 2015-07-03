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
var COMMAND_TYPE = {init: 0, keyboard: 1, shoot: 2, update: 3};
var pack = [
	{id: 'Int32', x: 'Int32', y: 'Int32'},
	{key: 'Uint8'}, 
	{x1: 'Float32', y1: 'Float32', x2: 'Float32', y2: 'Float32'},
	{x: 'Float32', y: 'Float32'}
]

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
		console.log(e.clientX + " " + e.clientY + " " + player.x + " " + player.y + " " + player.graphic.x + " " + player.graphic.y);
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

function decrypt(ab) {
	//keyboard
	var res = {};
	var dv = new DataView(ab);
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
	return res;
}

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
		var data = decrypt(event.data);
		// console.log(data);
		switch (data.command) {
			case COMMAND_TYPE.init:
				//construct player
				player = new createPlayer(data.id, data.x, data.y);
				break;
			case COMMAND_TYPE.update:
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
			socket.send(encrypt({command: COMMAND_TYPE.keyboard, key: m}));
		}
		if (gameInput.mouse.down) {
			shootBullet(player, player.x, player.y, gameInput.mouse.x, gameInput.mouse.y);
			socket.send(encrypt({command: COMMAND_TYPE.shoot, x1: player.x, y1: player.y, x2: gameInput.mouse.x, y2: gameInput.mouse.y}));
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
	this.graphic = drawCircle(x, y, playerConfig.defaultSize);
	this.id = id != undefined ? id : -1;
	this.x = x != undefined ? x : 0;
	this.y = y != undefined ? y : 0;
	this.reloadInterval = reloadInterval != undefined ? reloadInterval : 500;
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
	this.graphic = drawCircle(x1, y1, 1);
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
