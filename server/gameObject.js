var Player = function (id, x, y) {
	this.id = id;
	this.x = x;
	this.y = y;
}

exports.Player = function (id, x, y) {
	return new Player(id, x, y);
}