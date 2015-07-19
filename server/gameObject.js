var Player = function (id, x, y, socket) {
	this.id = id;
	this.x = x;
	this.y = y;
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
		return (this.x < 0 || this.x > 1000 || this.y < 0 || this.y > 1000	);
	};

	this.update = function() {
		var date = new Date();
		var cur = date.getTime() % 100000;
		this.x = this.sx + this.dx * (cur - this.stime);
		this.y = this.sy + this.dy * (cur - this.stime);
	}
}

exports.Player = function (id, x, y, socket) {
	return new Player(id, x, y, socket);
}

exports.Bullet = function (id, stime, x1, y1, dx, dy) {
	return new Bullet(id, stime, x1, y1, dx, dy);
}