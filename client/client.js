'use strict';

var graphicStage = null;
var masterStage = null;
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
var fogMask = null;
var fog = null;
var background = null;
var polyFog = new PIXI.Graphics();
var center = {x: screenWidth / 2, y: screenHeight / 2};
var curReceivedTime = 0;

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

function findIndexByValue(arr, val) {
    var len = arr.length;
    while (len--) {
        if (arr[len].x == val.x && arr[len].y == val.y) {
            return len;
        }
    }
    return -1;
}

function updatePosition(player, data) {
	//update player, check snapshot
	if (data.id == player.id) {
		var idx = findIndexByValue(playerSnapshot, {x: data.x, y: data.y}); //the package order can be messed up
		if (idx == -1) {
			player.x = data.x;
			player.y = data.y;
		} else {
			playerSnapshot.splice(idx, 1);
		}
	} else {
		//update other players
		var player = players[findIndex(players, data.id)]; 
		player.x = data.x;
		player.y = data.y;
	}
}

function updateHP(data) {
	var player = players[findIndex(players, data.id)]; 
	player.health = data.health;
}

function initPlayer(data) {
	var tempPlayer = new Player(data.id, data.x, data.y, data.health, data.main === 1);
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

function inField(x, y, size) {
	return x >= size && 
		x <= constant.GAME_WIDTH - size &&
		y >= size &&
		y <= constant.GAME_HEIGHT - size
}

function movePlayer(player, d) {
	//Client prediction
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

function processMouseEvent(id, x1, y1, x2, y2) {
	if (Date.now() - player.shotTime > player.reloadInterval) {
		socket.send(coding.encrypt({command: constant.COMMAND_TYPE.MOUSE, id: id, x1: x1, y1: y1, x2: x2, y2: y2, stime: Date.now() % 100000}));
		player.shotTime = Date.now();
	}
}

function processMouseBuildEvent(x, y) {
	var yblock = Math.trunc(y / constant.BLOCK_SIZE);
	var xblock = Math.trunc(x / constant.BLOCK_SIZE);
	if (tiles[yblock][xblock] !== true &&
		inField(x, y, 0)) {
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
	return x + player.x - center.x;
}

function toAbsoluteY(y) {
	return y + player.y - center.y;
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

	// drawFog();
	// drawSimpleFog();
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

function depthCompare(a, b) {
	if (a.z < b.z)
			return -1;
		if (a.z > b.z)
		return 1;
  	return 0;
}

function animate() {	
    requestAnimationFrame(animate);
	now = Date.now();
	var delta = now - then;	
	//setup framerate
	if (delta > interval) {
	    gameLoop();
	   	graphicStage.children.sort(depthCompare);
	   	masterStage.children.sort(depthCompare);
	    graphicRenderer.render(masterStage);
	    then = now - (delta % interval);
	}
}

PIXI.FogFilter = function() {
    PIXI.AbstractFilter.call(this,
        // vertex shader
        null,
        // fragment shader
        ['precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'uniform sampler2D uSampler;',
        'uniform float screenWidth;',
        'uniform float fogRange;',
        'uniform float screenHeight;',
        'void main(void)',
        '{',
        'float dist = sqrt((gl_FragCoord.x - screenWidth / 2.0) * (gl_FragCoord.x - screenWidth / 2.0) + (gl_FragCoord.y - screenHeight / 2.0) * (gl_FragCoord.y - screenHeight / 2.0));',
        'gl_FragColor = texture2D(uSampler, vTextureCoord);',
        // 'const float LOG2 = 1.442695;',
        // 'float fogFactor = exp2(-5.0 * 5.0 * dist * dist * LOG2);',
        // 'fogFactor = clamp(fogFactor, 0.0, 1.0);',
        'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0, 0.0, 0.0), clamp((dist - 200.0) / (fogRange - 200.0), 0.0, 1.0) );',	
		'}'].join('\n'),
        // set the uniforms
        {
            screenWidth: { type: '1f', value: screenWidth },
            screenHeight: { type: '1f', value: screenHeight },
            fogRange: { type: '1f', value: constant.FOG_RANGE }
        }
    );
};

PIXI.FogFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
PIXI.FogFilter.prototype.constructor = PIXI.FogFilter;

function drawText(x, y, text, depth) {
	var text = new PIXI.Text(text, {fill: 0x0033FF});
	masterStage.addChild(text);
	text.position.x = x;
	text.position.y = y;
	text.z = depth;
	return text;
}

function drawPlayer(centerX, centerY, mainChar) {
	var playerGraphic = new PIXI.Container();
	var color = mainChar === true ? constant.PLAYER_CONFIG.DEFAULT_COLOR : constant.ENEMY_CONFIG.DEFAULT_COLOR;
	var body = drawCircle(0, 0, constant.PLAYER_CONFIG.DEFAULT_SIZE, color, constant.PLAYER_DEPTH);
	var healthBar = drawRectangle(-50, -35, 100, 10, 0xFF0000, false, constant.PLAYER_DEPTH);
	healthBar.healthBar = true; //set this Flag for futher tracing
	playerGraphic.addChild(body);
	playerGraphic.addChild(healthBar);

	playerGraphic.z = constant.PLAYER_DEPTH;

	graphicStage.addChild(playerGraphic);
	return {player: playerGraphic, healthBar: healthBar, body: body};
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

function drawRectangle(x1, y1, w, h, color, border, depth, container) {
	var rect = new PIXI.Graphics();
	if (border === true)
		rect.lineStyle(2, 0x000100, 1);
	else
		rect.lineStyle(0, 0x000100, 1);

	rect.beginFill(color);
	rect.drawRect(x1, y1, w, h);
	rect.z = depth;
	if (container === undefined)
		graphicStage.addChild(rect);
	else
		container.addChild(rect);

	return rect;
}

function drawPolygon(poly) {
	var polygon = new PIXI.Graphics();
	var points = [];
	for (var iPoly in poly) {
		points.push(new PIXI.Point(poly[iPoly].x, poly[iPoly].y));
	}
	polygon.lineStyle(2, 0x000000, 1);
	polygon.beginFill(0x0000FF);
	polygon.drawPolygon(points);
	graphicStage.addChild(polygon);

	return polygon;
}

function isOnSegment(x, y, x1, y1, x2, y2) {
	return x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
}

function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
	var x12 = x1 - x2;
	var x34 = x3 - x4;
	var y12 = y1 - y2;
	var y34 = y3 - y4;
	var c = x12 * y34 - y12 * x34;

	if (Math.abs(c) < 0.001) {
		return {x: -1, y: -1};
	} else {
		var a = x1 * y2 - y1 * x2;
		var b = x3 * y4 - y3 * x4;

		var x = (a * x34 - b * x12) / c;
		var y = (a * y34 - b * y12) / c;
		if (isOnSegment(x, y, x1, y1, x2, y2) && isOnSegment(x, y, x3, y3, x4, y4)) {
			return {x: x, y: y};
		} else {
			return {x: -1, y: -1};
		}
	}
}

//TODO: some line is shortened, need to be lengthen
function getShortestLine(x1, y1, x2, y2) {
	var p = getPointOnCircle(x2, y2);
	var nearestPoint = {x: p.x, y: p.y};
	for (var iBlock in blocks) {
		var rblock = {x1: toRelativeX(blocks[iBlock].x), y1: toRelativeY(blocks[iBlock].y), x2: toRelativeX(blocks[iBlock].x)  + constant.BLOCK_SIZE, y2: toRelativeY(blocks[iBlock].y + constant.BLOCK_SIZE)};
		var point = intersect(x1, y1, x2, y2, rblock.x1, rblock.y1, rblock.x2, rblock.y1);
		if (point.x !== -1 && point.y !== -1) {
			if (dist(center.x, center.y, point.x, point.y) < dist(center.x, center.y, nearestPoint.x, nearestPoint.y)) {
				nearestPoint = point;
			}
		}
		point = intersect(x1, y1, x2, y2, rblock.x1, rblock.y1, rblock.x1, rblock.y2);
		if (point.x !== -1 && point.y !== -1) {
			if (dist(center.x, center.y, point.x, point.y) < dist(center.x, center.y, nearestPoint.x, nearestPoint.y)) {
				nearestPoint = point;
			}
		}
		point = intersect(x1, y1, x2, y2, rblock.x2, rblock.y1, rblock.x2, rblock.y2);
		if (point.x !== -1 && point.y !== -1) {
			if (dist(center.x, center.y, point.x, point.y) < dist(center.x, center.y, nearestPoint.x, nearestPoint.y)) {
				nearestPoint = point;
			}
		}
		point = intersect(x1, y1, x2, y2, rblock.x1, rblock.y2, rblock.x2, rblock.y2);
		if (point.x !== -1 && point.y !== -1) {
			if (dist(center.x, center.y, point.x, point.y) < dist(center.x, center.y, nearestPoint.x, nearestPoint.y)) {
				nearestPoint = point;
			}
		}
	}

	nearestPoint.line = isLine(nearestPoint.x, nearestPoint.y);
	return nearestPoint;
}

function crossCompare(point1, point2) {
	if ((point1.x - center.x) * (point2.y - center.y) < (point1.y - center.y) * (point2.x - center.x))
		return -1;
	if ((point1.x - center.x) * (point2.y - center.y) > (point1.y - center.y) * (point2.x - center.x))
		return 1;
  	return 0;
}

function getPointOnCircle(x, y) {
	return {x: center.x + (x - center.x) / dist(center.x, center.y, x, y) * constant.FOG_RANGE, y: center.y + (y - center.y) / dist(center.x, center.y, x, y) * constant.FOG_RANGE};
}

function isLine(x, y) {
	x = x + (x - center.x) / dist(center.x, center.y, x, y) * 0.01;
	y = y + (y - center.y) / dist(center.x, center.y, x, y) * 0.01;
	var yblock = Math.trunc(toAbsoluteY(y) / constant.BLOCK_SIZE);
	var xblock = Math.trunc(toAbsoluteX(x) / constant.BLOCK_SIZE);
	return (tiles[yblock][xblock] !== true);
}

function isValidArcLine(x, y, px, py, rect) {
	return x == px && y == py && isLine(x, y, rect);
}

function getRelativeAngle(x, y) {
	return Math.atan2(y - center.y, x - center.x);
}

function isLineBlocked(x, y) {
	for (var iBlock in blocks) {
		var rblock = {x1: toRelativeX(blocks[iBlock].x), y1: toRelativeY(blocks[iBlock].y), x2: toRelativeX(blocks[iBlock].x) + constant.BLOCK_SIZE, y2: toRelativeY(blocks[iBlock].y + constant.BLOCK_SIZE)};
		var point = intersect(center.x, center.y, x, y, rblock.x1, rblock.y1, rblock.x2, rblock.y1);
		if (point.x !== -1 && point.y !== -1) {
			return true;
		}
		point = intersect(center.x, center.y, x, y, rblock.x1, rblock.y1, rblock.x1, rblock.y2);
		if (point.x !== -1 && point.y !== -1) {
			return true;
		}
		point = intersect(center.x, center.y, x, y, rblock.x2, rblock.y1, rblock.x2, rblock.y2);
		if (point.x !== -1 && point.y !== -1) {
			return true;
		}
		point = intersect(center.x, center.y, x, y, rblock.x1, rblock.y2, rblock.x2, rblock.y2);
		if (point.x !== -1 && point.y !== -1) {
			return true;
		}
	}
	return false;	
}

function drawSimpleFog() {
	polyFog.clear();
	polyFog.lineStyle(0, 0x000000, 1);
	polyFog.beginFill(0x0000FF);
	polyFog.alpha = 0.5;
	polyFog.z = constant.FOG_DEPTH;
	for (var i = -1; i <= screenHeight / constant.FOG_BLOCK_SIZE + 1; i++) {
		for (var j = -1; j <= screenWidth / constant.FOG_BLOCK_SIZE + 1; j++) {
			var x = toRelativeX(Math.trunc(toAbsoluteX(j * constant.FOG_BLOCK_SIZE) / constant.FOG_BLOCK_SIZE) * constant.FOG_BLOCK_SIZE);
			var y = toRelativeY(Math.trunc(toAbsoluteY(i * constant.FOG_BLOCK_SIZE) / constant.FOG_BLOCK_SIZE) * constant.FOG_BLOCK_SIZE);
			if (!isLineBlocked(x + constant.FOG_BLOCK_SIZE / 2, y + constant.FOG_BLOCK_SIZE / 2)) {
				polyFog.drawRect(x, y, constant.FOG_BLOCK_SIZE, constant.FOG_BLOCK_SIZE);
				var yblock = Math.trunc(toAbsoluteY(y) / constant.BLOCK_SIZE);
				var xblock = Math.trunc(toAbsoluteX(x) / constant.BLOCK_SIZE);
				for (var u = -1; u <= 1; u++)
					for (var v = -1; v <= 1; v++) {
					if (yblock + u >= 0 && xblock + v >= 0 && tiles[yblock + u][xblock + v] === true) {
						polyFog.drawRect(toRelativeX((xblock + v) * constant.BLOCK_SIZE), toRelativeY((yblock + u) * constant.BLOCK_SIZE), constant.BLOCK_SIZE, constant.BLOCK_SIZE);
					}
				}
			}
		}
	}

	// for (var iBlock in blocks) {
	// 	var rblock = {x1: toRelativeX(blocks[iBlock].x), y1: toRelativeY(blocks[iBlock].y), x2: toRelativeX(blocks[iBlock].x)  + constant.BLOCK_SIZE, y2: toRelativeY(blocks[iBlock].y + constant.BLOCK_SIZE)};
	// 	polyFog.drawRect(rblock.x1, rblock.y1, constant.BLOCK_SIZE, constant.BLOCK_SIZE);
	// }
	graphicStage.addChild(polyFog);
}

function drawFog() {
	var poly = [];
	var arc = [];
	// poly.push(center);
	for (var iBlock in blocks) {
		var rblock = {x1: toRelativeX(blocks[iBlock].x), y1: toRelativeY(blocks[iBlock].y), x2: toRelativeX(blocks[iBlock].x)  + constant.BLOCK_SIZE, y2: toRelativeY(blocks[iBlock].y + constant.BLOCK_SIZE)};
		//TODO: Convert to line instead of segment
		poly.push(getShortestLine(center.x, center.y, rblock.x1, rblock.y1));
		//if is line and not blocked
		// if (isValidArcLine(rblock.x1, rblock.y1, poly[poly.length - 1].x, poly[poly.length - 1].y, rblock)) {
		// 	poly[poly.length - 1].line = true;
		// }

		poly.push(getShortestLine(center.x, center.y, rblock.x1, rblock.y2));
		// if (isValidArcLine(rblock.x1, rblock.y2, poly[poly.length - 1].x, poly[poly.length - 1].y, rblock)) {
		// 	poly[poly.length - 1].line = true;
		// }

		poly.push(getShortestLine(center.x, center.y, rblock.x2, rblock.y1));
		// if (isValidArcLine(rblock.x2, rblock.y1, poly[poly.length - 1].x, poly[poly.length - 1].y, rblock)) {
		// 	poly[poly.length - 1].line = true;
		// }

		poly.push(getShortestLine(center.x, center.y, rblock.x2, rblock.y2));
		// if (isValidArcLine(rblock.x2, rblock.y2, poly[poly.length - 1].x, poly[poly.length - 1].y, rblock)) {
		// 	poly[poly.length - 1].line = true;
		// }

	}
	poly.sort(crossCompare);

	// console.log("hi");
	// 	//TODO: Convert to line instead of segment

	// for (var iPoly in poly) {
	// 	console.log(poly[iPoly]);
	// }
	// console.log("he");
	
	if (poly.length > 0) {
		var points = [];
		polyFog.clear();
		polyFog.lineStyle(0, 0x000000, 1);
		polyFog.beginFill(0x0000FF);
		polyFog.z = constant.FOG_DEPTH;
		for (var iPoly = 0; iPoly < poly.length; iPoly++) {
		// for (var iPoly in poly) {
			// points.push(new PIXI.Point(poly[iPoly].x, poly[iPoly].y));
			if (poly[iPoly].line === true && poly[(iPoly + 1) % poly.length].line === true) {
				var p1 = getPointOnCircle(poly[iPoly].x, poly[iPoly].y);
				var p2 = getPointOnCircle(poly[(iPoly + 1) % poly.length].x, poly[(iPoly + 1) % poly.length].y);

				polyFog.moveTo(center.x, center.y);
				// polyFog.lineTo(p1.x, p1.y);
				// console.log(getRelativeAngle(poly[iPoly].x, poly[iPoly].y));
				// console.log(getRelativeAngle(poly[(iPoly + 1) % poly.length].x, poly[(iPoly + 1) % poly.length].y));
				polyFog.arc(center.x, center.y, constant.FOG_RANGE, getRelativeAngle(poly[(iPoly + 1) % poly.length].x, poly[(iPoly + 1) % poly.length].y), getRelativeAngle(poly[iPoly].x, poly[iPoly].y), false);
				// polyFog.arc(center.x, center.y, constant.FOG_RANGE / 2, getRelativeAngle(poly[(iPoly + 1) % poly.length].x, poly[(iPoly + 1) % poly.length].y), getRelativeAngle(poly[iPoly].x, poly[iPoly].y), true);
				// polyFog.arcTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, p2.x, p2.y, constant.FOG_RANGE);
				// polyFog.lineTo(poly[(iPoly + 1) % poly.length].x, poly[(iPoly + 1) % poly.length].y);
				// polyFog.lineTo(p2.x, p2.y);
				// polyFog.lineTo(center.x, center.y);
				// polyFog.moveTo(center.x, center.y);
			} else {
				polyFog.moveTo(center.x, center.y);
				polyFog.lineTo(poly[iPoly].x, poly[iPoly].y);
				polyFog.lineTo(poly[(iPoly + 1) % poly.length].x, poly[(iPoly + 1) % poly.length].y);
				polyFog.lineTo(center.x, center.y);
			}
		}
		// polyFog.drawPolygon(points);
			for (var iBlock in blocks) {
				var rblock = {x1: toRelativeX(blocks[iBlock].x), y1: toRelativeY(blocks[iBlock].y), x2: toRelativeX(blocks[iBlock].x)  + constant.BLOCK_SIZE, y2: toRelativeY(blocks[iBlock].y + constant.BLOCK_SIZE)};
				polyFog.drawRect(rblock.x1, rblock.y1, constant.BLOCK_SIZE, constant.BLOCK_SIZE);
			}
		graphicStage.addChild(polyFog);
	}
}

function toRelativeX(x) {
	return x - player.x + screenWidth / 2;
}

function toRelativeY(y) {
	return y - player.y + screenHeight / 2;
}

function setupSocket(socket) {

	socket.onopen = function (event) { 

	}

	socket.onmessage = function (event) {
		var data = coding.decrypt(event.data);
		// console.log(data);
		switch (data.command) {
			case constant.COMMAND_TYPE.INIT:
				initPlayer(data);
				break;
			case constant.COMMAND_TYPE.UPDATE:
				updatePosition(player, data);
				break;
			case constant.COMMAND_TYPE.HPCHANGE:
				updateHP(data);
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
	masterStage = new PIXI.Container(); //Contain GUI and GraphicStage
    graphicStage = new PIXI.Container(); //affected by fog
    
    // fogMask = drawCircle(screenWidth / 2, screenHeight / 2, constant.FOG_RANGE, 0x000000, 0);
    // fog = drawCircle(screenWidth / 2, screenHeight / 2, constant.FOG_RANGE, 0xFFFFFF, 0);
    background = drawRectangle(0, 0, screenWidth, screenHeight, 0x000000, false, 0, masterStage);

    // graphicStage.addChild(fog);
    graphicStage.mask = polyFog;
    graphicStage.filters = [new PIXI.FogFilter()];

    masterStage.addChild(graphicStage);
    setupGUI();
    setupMap();
}

class GraphicObject {
	constructor (id, x, y) {
		this.id = id !== undefined ? id : -1;
		this.x = x !== undefined ? x : 0;
		this.y = y !== undefined ? y : 0;		

		gameObj.push(this);
	}

	updateGraphic() {
		this.graphic.position.x = toRelativeX(this.x);
		this.graphic.position.y = toRelativeY(this.y);			
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
		if (this.graphic.children.length == 0) {
			this.graphic.clear();
		}
		else {
			for (var iChildren in this.graphic.children) {
				this.graphic.children[iChildren].clear();
			}
		}
		delete this.graphic;
		graphicStage.removeChild(this.graphic);		
	}
}

class Player extends GraphicObject {
	constructor (id, x, y, health, mainChar, reloadInterval) {
		super(id, x, y);
		// var color = mainChar === true ? constant.PLAYER_CONFIG.DEFAULT_COLOR : constant.ENEMY_CONFIG.DEFAULT_COLOR;
		// this.graphic = drawCircle(0, 0, constant.PLAYER_CONFIG.DEFAULT_SIZE, color, constant.PLAYER_DEPTH);
		var playerGraphic = drawPlayer(0, 0, mainChar);
		this.graphic = playerGraphic.player;
		this.healthBarGraphic = playerGraphic.healthBar;
		this.bodyGraphic = playerGraphic.body;
		this.bodyGraphic.filters = [new PIXI.filters.DropShadowFilter()];

		this.reloadInterval = reloadInterval !== undefined ? reloadInterval : 100;
		this.shotTime = -1000000;
		this.health = health;
	}

	updateGraphic() {
		//if it is main player
		if (this === player) {
			this.graphic.x = screenWidth / 2;
			this.graphic.y = screenHeight / 2;
		} else {
			super.updateGraphic();
		}
		this.healthBarGraphic.width = this.health;
	}
}

class Bullet extends GraphicObject {
	constructor (stime, x1, y1, dx, dy) {
		super(-1, x1, y1);
		this.graphic = drawCircle(0, 0, 2, 0x000000, constant.BULLET_DEPTH);
		this.graphic.alpha = 0;
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
			if (this.graphic.alpha == 0) {
				this.graphic.alpha = 1;
			}
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
		this.graphic = drawRectangle(0, 0, constant.BLOCK_SIZE, constant.BLOCK_SIZE, 0x00FFFF, true, constant.BLOCK_DEPTH);

		// // var renderTexture = new PIXI.RenderTexture(constant.BLOCK_SIZE, constant.BLOCK_SIZE);
		// // renderTexture.render(graphic);
		// // var renderedContainer = new PIXI.Sprite(renderTexture);

		// this.graphic = renderedContainer;

		// var filter = new PIXI.filters.DropShadowFilter();
		// filter.applyFilter(graphicRenderer, this.graphic, player.graphic);
		// console.log(getShader(graphicRenderer));
	}
}

class Map extends GraphicObject {
	constructor (x1, y1, x2, y2) {
		super(-1, x1, y1);
		this.x = x1;
		this.y = y1;
		this.graphic = drawRectangle(x1, y1, x2, y2, 0xFFFFFF, false, constant.MAP_DEPTH);
	}
}

setupGraphic();
setupGameObject();
setupSocket(socket);
requestAnimFrame(animate);
//Graphic
// animate();
