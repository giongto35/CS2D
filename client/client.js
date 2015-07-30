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

var bullets = [];
var blocks = [];
var gameObj = [];
var player = {}; //create by new player
var gameInput = {mouse: {down: false, x: 0, y: 0}, keyboard: {37: false, 38: false, 39: false, 40: false}};
var players = [];
var running = true;
var pingText = {};
var fps = 60;
var interval = 1000 / fps;
var now;
var then = Date.now();
var pingTime = 0;
var pingTimeLim = 10000;
var playerSnapshot = [];
var tiles = [[]];

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
	bullets.push(new Bullet(data.stime, data.x1, data.y1, data.dx, data.dy));	
}

function showPing(data) {
	pingText.text = 'Ping : ' + String(Date.now() % 100000 - data.stime);
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
		console.log(pos);
		if (pos !== undefined && !(pos.x == data.x && pos.y == data.y)) {
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

function movePlayer(player, d) {
	//Client prediction
	player.x += constant.DIR[d].x * constant.PLAYER_CONFIG.SPEED;
	player.y += constant.DIR[d].y * constant.PLAYER_CONFIG.SPEED;

	if (player.x < constant.PLAYER_CONFIG.DEFAULT_SIZE || 
		player.x > constant.GAME_WIDTH - constant.PLAYER_CONFIG.DEFAULT_SIZE || 
		player.y < constant.PLAYER_CONFIG.DEFAULT_SIZE || 
		player.y > constant.GAME_HEIGHT - constant.PLAYER_CONFIG.DEFAULT_SIZE) {
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

//after receiving BUILD message
function buildBlock(data) {
	if (tiles[data.y][data.x] !== true) {
		blocks.push(new Block(data.x * constant.BLOCK_SIZE, data.y * constant.BLOCK_SIZE));
		tiles[data.y][data.x] = true;
	}
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
			case constant.COMMAND_TYPE.MOUSEBUILD:
				buildBlock(data);
				break;
		}
  	}

}

function setupGUI() {
	pingText = drawText(0, 0, "", constant.TEXT_DEPTH);
}

function setupMap() {
	//Draw border
	new Map(0, 0, constant.GAME_WIDTH, constant.GAME_HEIGHT);
}

function setupGameObject() {
	tiles = new Array(Math.trunc(constant.GAME_HEIGHT / constant.BLOCK_SIZE) + 1);
	for(var i = 0; i < tiles.length; i++) {
    	tiles[i] = new Array(Math.trunc(constant.GAME_WIDTH / constant.BLOCK_SIZE) + 1);
	}
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
    setupMap();
}

function processMouseEvent(id, x1, y1, x2, y2) {
	if (Date.now() - player.shotTime > player.reloadInterval) {
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.MOUSE, id: id, x1: x1, y1: y1, x2: x2, y2: y2, stime: Date.now() % 100000}));
		player.shotTime = Date.now();
	}
}

function processMouseBuildEvent(x, y) {
	var yblock = Math.trunc(y / constant.BLOCK_SIZE);
	var xblock = Math.trunc(x / constant.BLOCK_SIZE);
	if (tiles[yblock][xblock] !== true) {
		blocks.push(new Block(xblock * constant.BLOCK_SIZE, yblock * constant.BLOCK_SIZE));
		tiles[yblock][xblock] = true;
		//Can someone exploit here because of precalculation in client?
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.MOUSEBUILD, x: xblock, y: yblock}));
	}
}

function validKey(key) {
	//TODO
	return true;
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
	if (validKey(m)) {
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.KEYBOARD, id: id, key: m}));
	}
}

function sendPingEvent() {
	socket.send(coding.encrypt({command: constant.COMMAND_TYPE.PING, stime: Date.now() % 100000}));
}

function toAbsoluteX(x) {
	return x + player.x - screenWidth / 2;
}

function toAbsoluteY(y) {
	return y + player.y - screenHeight / 2;
}

function updateGameState() {
	//update by game input
	for (var m in gameInput.keyboard) {
		if (gameInput.keyboard[m]) {
			processKeyboardEvent(player.id, m);
		}
	}
	if (gameInput.mouse.down) {
		if (gameInput.keyboard[constant.KEY_SHIFT]) {
			if (dist(toAbsoluteX(gameInput.mouse.x), toAbsoluteY(gameInput.mouse.y), player.x, player.y) > constant.BUILD_LIM) {
				processMouseBuildEvent(toAbsoluteX(gameInput.mouse.x), toAbsoluteY(gameInput.mouse.y));
			}
		} else {
			processMouseEvent(player.id, player.x, player.y, toAbsoluteX(gameInput.mouse.x), toAbsoluteY(gameInput.mouse.y));
		}
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
	   	graphicStage.children.sort(function depthCompare(a,b) {
			if (a.z < b.z)
   				return -1;
  			if (a.z > b.z)
    			return 1;
		  	return 0;
		});
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

function drawText(x, y, text, depth) {
	var text = new PIXI.Text(text);
	graphicStage.addChild(text);
	text.position.x = x;
	text.position.y = y;
	text.z = depth;
	return text;
}

function drawCircle(centerX, centerY, radius, color, depth) {
	var circle = new PIXI.Graphics();
    circle.lineStyle(2, 0x000100, 1);
	circle.beginFill(color);
	circle.drawCircle(centerX, centerY, radius);
	circle.z = depth;
	graphicStage.addChild(circle);

	return circle;
}

function drawRectangle(x1, y1, x2, y2, color, depth) {
	var rect = new PIXI.Graphics();
	rect.lineStyle(2, 0x000100, 1);
	rect.beginFill(color);
	rect.drawRect(x1, y1, x2, y2);
	rect.z = depth;
	graphicStage.addChild(rect);

	return rect;
}

function toRelativeX(x) {
	return x - player.x + screenWidth / 2;
}

function toRelativeY(y) {
	return y - player.y + screenHeight / 2;
}

class GraphicObject {
	constructor (id, x, y) {
		this.id = id !== undefined ? id : -1;
		this.x = x !== undefined ? x : 0;
		this.y = y !== undefined ? y : 0;		

		gameObj.push(this);
	}

	updateGraphic() {
		this.graphic.x = toRelativeX(this.x);
		this.graphic.y = toRelativeY(this.y);
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
		this.graphic = drawCircle(0, 0, constant.PLAYER_CONFIG.DEFAULT_SIZE, color, constant.PLAYER_DEPTH);
		this.reloadInterval = reloadInterval !== undefined ? reloadInterval : 100;
		this.shotTime = -1000000;
	}

	updateGraphic() {
		//if it is main player
		if (this === player) {
			this.graphic.x = screenWidth / 2;
			this.graphic.y = screenHeight / 2;
		} else {
			super.updateGraphic();
		}
	}
}

class Bullet extends GraphicObject {
	constructor (stime, x1, y1, dx, dy) {
		super(-1, x1, y1);
		this.graphic = drawCircle(0, 0, 1, 0x000000, constant.BULLET_DEPTH);
		this.sx = x1;
		this.sy = y1;
		this.dx = dx;
		this.dy = dy;
		this.stime = stime;
	}

	invalid() {
		this.update();

		for (var iBlock in blocks) {
			var block = blocks[iBlock];
			if (checkCirRectCollision(
				{x: this.x, y: this.y, radius: 1}, 
				{x1: block.x, y1: block.y, x2: block.x + constant.BLOCK_SIZE, y2: block.y + constant.BLOCK_SIZE})) {
				return true;
			}
		}

		return (this.x < 0 || this.x > constant.GAME_WIDTH || this.y < 0 || this.y > constant.GAME_HEIGHT);
	}

	update() {
		var cur = Date.now() % 100000;
		if (cur > this.stime) {
			this.x = this.sx + this.dx * (cur - this.stime);
			this.y = this.sy + this.dy * (cur - this.stime);
		}
		this.updateGraphic();
	}
}

class Block extends GraphicObject {
	constructor (x, y) {
		super(-1, x, y);
		this.x = x; //Math.trunc(x / constant.BLOCK_SIZE) * constant.BLOCK_SIZE;
		this.y = y; //Math.trunc(y / constant.BLOCK_SIZE) * constant.BLOCK_SIZE;
		this.graphic = drawRectangle(0, 0, constant.BLOCK_SIZE, constant.BLOCK_SIZE, 0x00FFFF, constant.BLOCK_DEPTH);
	}
}

class Map extends GraphicObject {
	constructor (x1, y1, x2, y2) {
		super(-1, x1, y1);
		this.x = x1;
		this.y = y1;
		this.graphic = drawRectangle(x1, y1, x2, y2, 0xFFFFFF, constant.MAP_DEPTH);
	}
}
setupGraphic();
setupGameObject();
setupSocket(socket);
requestAnimFrame(animate);
//Graphic
// animate();
