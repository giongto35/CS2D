'use strict';

var graphicStage = null;
var graphicRenderer = null;

var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var xoffset = -constant.GAME_WIDTH;
var yoffset = -constant.GAME_HEIGHT;
var host = location.origin.replace(/^http/, 'ws');
var socket = new WebSocket(host);
socket.binaryType = 'arraybuffer';

var bulletArr = [];
var gameObj = [];
var player = {}; //create by new player
var gameInput = {mouse: {down: false, x: 0, y: 0}, keyboard: {37: false, 38: false, 39: false, 40: false}};
var players = [];
var running = true;
var pingText = {};
var fps = 30;
var interval = 1000 / fps;
var now;
var then = Date.now();
var pingTime = 0;
var pingTimeLim = 1000;
var playerSnapshot = [];

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

function showPing(data) {
	pingText.text = "Ping : " + String(Date.now() % 100000 - data.stime);
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

function updatePosition(player, data) {
	//update player, check snapshot
	if (data.id == player.id) {
		var pos = playerSnapshot.shift();
		if (!(pos.x == data.x && pos.y == data.y)) {
			player.x = data.x;
			player.y = data.y;
		}
	} else {
		//update other players
		var player = players[findIndex(players, data.id)]; 
		player.x = data.x;
		player.y = data.y;
	}
}

function initPlayer(data) {
	var tempPlayer = new Player(data.id, data.x, data.y, data.main === 1);
	if (data.main == 1) {
		player = tempPlayer;
	} 
	players.push(tempPlayer);					
}

function dist(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function checkCollision(obj1, obj2, lim) {
	return (dist(obj1.x, obj1.y, obj2.x, obj2.y) < lim);
}

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
	playerSnapshot.push({x: player.x, y: player.y});
}

function removePlayer(data) {
	if (data.id == player.id) {
		player.destroy();
		running = false;
		alert("You got hit. Reload to replay");
		socket.close();
	}
	var idx = findIndex(players, data.id);
	players[idx].destroy();
	players.splice(idx, 1);
}

function setupSocket(socket) {

	socket.onopen = function (event) { 

	}

	socket.onmessage = function (event) {
		var data = coding.decrypt(event.data);
		console.log(data);
		switch (data.command) {
			case constant.COMMAND_TYPE.INIT:
				initPlayer(data);
				break;
			case constant.COMMAND_TYPE.UPDATE:
				updatePosition(player, data);
				break;
			case constant.COMMAND_TYPE.DESTROY:
				removePlayer(data);
				break;
			case constant.COMMAND_TYPE.SHOOT:
				shootBullet(data);
				break;
			case constant.COMMAND_TYPE.PING:
				showPing(data);
				break;
		}
  	}

}

function setupGUI() {
	pingText = drawText(0, 0, "");
}

function setupGraphic() {
	window.requestAnimFrame = (function(){
	  return  window.requestAnimationFrame       ||
	          window.webkitRequestAnimationFrame ||
	          window.mozRequestAnimationFrame    ||
	          function( callback ){
	            window.setTimeout(callback, interval);
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
    setupGUI();
}

function processMouseEvent(id, x1, y1, x2, y2) {
	if (Date.now() - player.shotTime > player.reloadInterval) {
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.MOUSE, id: id, x1: x1, y1: y1, x2: x2, y2: y2, stime: Date.now() % 100000}));
		player.shotTime = Date.now();
	}
	// socket.send(coding.encrypt({command: constant.COMMAND_TYPE.SHOOT, id: player.id, stime: stime, x1: player.x, y1: player.y, dx: dx, dy: dy}));
}

function processKeyboardEvent(id, m) {
	if (m == constant.KEY_LEFT || m == constant.KEY_A) {
		movePlayer(player, 0);
	}		
	if (m == constant.KEY_UP || m == constant.KEY_W) {
		movePlayer(player, 1);
	}
	if (m == constant.KEY_RIGHT || m == constant.KEY_D) {
		movePlayer(player, 2);
	}
	if (m == constant.KEY_DOWN || m == constant.KEY_S) {
		movePlayer(player, 3);
	}
	socket.send(coding.encrypt({command: constant.COMMAND_TYPE.KEYBOARD, id: id, key: m}));
}

function sendPingEvent() {
	socket.send(coding.encrypt({command: constant.COMMAND_TYPE.PING, stime: Date.now() % 100000}));
}

function updateGameState() {
	//update by game input
	for (var m in gameInput.keyboard) {
		if (gameInput.keyboard[m]) {
			processKeyboardEvent(player.id, m);
		}
	}
	if (gameInput.mouse.down) {
		processMouseEvent(player.id, player.x, player.y, gameInput.mouse.x, gameInput.mouse.y);
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
	if (running) {
    	updateGameState();
    	if (Date.now() - pingTime > pingTimeLim) {
    		sendPingEvent();
    		pingTime = Date.now();
    	}
	}
    else {

    }
}

function animate() {	
    requestAnimationFrame(animate);
	now = Date.now();
	var delta = now - then;	
	//setup framerate
	if (delta > interval) {
	    gameLoop();
	    graphicRenderer.render(graphicStage);
	    then = now - (delta % interval);
	}
}
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
 
/**
 * This is the base class for creating a PIXI filter. Currently only webGL supports filters.
 * If you want to make a custom filter this should be your base class.
 * @class AbstractFilter
 * @constructor
 * @param fragmentSrc {Array} The fragment source in an array of strings.
 * @param uniforms {Object} An object containing the uniforms for this filter.
 */
PIXI.AbstractFilter = function(fragmentSrc, uniforms)
{
    /**
    * An array of passes - some filters contain a few steps this array simply stores the steps in a liniear fashion.
    * For example the blur filter has two passes blurX and blurY.
    * @property passes
    * @type Array an array of filter objects
    * @private
    */
    this.passes = [this];
 
    this.shaders = [];
    
    this.dirty = true;
 
    this.padding = 0;
 
    this.uniforms = uniforms || {};

    this.fragmentSrc = fragmentSrc || [];
};
 
PIXI.AbstractFilter.prototype.constructor = PIXI.AbstractFilter;
 
PIXI.AbstractFilter.prototype.syncUniforms = function()
{
    for(var i=0,j=this.shaders.length; i<j; i++)
    {
        this.shaders[i].dirty = true;
    }
};

function drawText(x, y, text) {
	var text = new PIXI.Text(text);
	graphicStage.addChild(text);
	text.position.x = x;
	text.position.y = y;

	return text;
}

function drawCircle(centerX, centerY, radius, color) {
	var circle = new PIXI.Graphics();
    circle.lineStyle ( 2, 0x000100,  1);
	circle.beginFill(color);
	circle.drawCircle(centerX, centerY, radius);	
	graphicStage.addChild(circle);

	return circle;
}

class GraphicObject {
	constructor (id, x, y) {
		this.id = id !== undefined ? id : -1;
		this.x = x !== undefined ? x : 0;
		this.y = y !== undefined ? y : 0;		

		gameObj.push(this);
	}

	updateGraphic() {
		this.graphic.x = this.x;
		this.graphic.y = this.y;
	}

	invalid() {

	}

	update() {
		this.updateGraphic();
	}

	destroy() {
		for (var iObj in gameObj) {
			if (gameObj[iObj] === this) {
				gameObj.splice(iObj, 1);
				break;
			}
		}
		this.graphic.clear();
		delete this.graphic;
		graphicStage.removeChild(this.graphic);		
	}
}

class Player extends GraphicObject {
	constructor (id, x, y, mainChar, reloadInterval) {
		super(id, x, y);
		var color = mainChar === true ? constant.PLAYER_CONFIG.DEFAULT_COLOR : constant.ENEMY_CONFIG.DEFAULT_COLOR;
		this.graphic = drawCircle(0, 0, constant.PLAYER_CONFIG.DEFAULT_SIZE, color);
		this.reloadInterval = reloadInterval !== undefined ? reloadInterval : 100;
		this.shotTime = -1000000;
	}
}

class Bullet extends GraphicObject {
	constructor (stime, x1, y1, dx, dy) {
		super(-1, x1, y1);
		this.graphic = drawCircle(0, 0, 1, 0x000000);
		this.sx = x1;
		this.sy = y1;
		this.dx = dx;
		this.dy = dy;
		this.stime = stime;
	}

	invalid() {
		this.update();
		return (this.x < 0 || this.x > constant.GAME_WIDTH || this.y < 0 || this.y > constant.GAME_HEIGHT);
	}

	update() {
		var date = new Date();
		var cur = Date.now() % 100000;
		this.x = this.sx + this.dx * (cur - this.stime);
		this.y = this.sy + this.dy * (cur - this.stime);
		this.updateGraphic();
	}
}

setupSocket(socket);
setupGraphic();
requestAnimFrame(animate);
//Graphic
// animate();
