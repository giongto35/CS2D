//GameObject for server

var constant = require('../share/const.js');

var Player = function (id, name, x, y, health, socket) {
	this.id = id;
	this.name = name;
	this.x = x;
	this.y = y;
	this.health = health;
	this.socket = socket;
}

var Bullet = function (id, stime, x1, y1, dx, dy) {
	this.playerId = id;
	this.sx = x1;
	this.sy = y1;
	this.x = x1;
	this.y = y1;
	this.dx = dx;
	this.dy = dy;
	this.stime = stime;

	this.invalid = function() {
		this.update();
		return (this.x < 0 || this.x > constant.GAME_WIDTH || this.y < 0 || this.y > constant.GAME_HEIGHT);
	};

	this.update = function() {
		var date = new Date();
		var cur = date.getTime() % 100000;
		this.x = this.sx + this.dx * (cur - this.stime);
		this.y = this.sy + this.dy * (cur - this.stime);
	}
}

var Block = function(x, y) {
	this.x = x;
	this.y = y;
}

exports.Player = function (id, name, x, y, health, socket) {
	return new Player(id, name, x, y, health, socket);
}

exports.Bullet = function (id, stime, x1, y1, dx, dy) {
	return new Bullet(id, stime, x1, y1, dx, dy);
}

exports.Block = function (x, y) {
	return new Block(x, y);
}