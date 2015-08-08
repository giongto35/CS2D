'use strict';

//Constants

//Shared
(function(exports){

	exports.BULLET_CONFIG = {
		SPEED: 1
	};

	exports.PLAYER_CONFIG = {
	    BORDER: 5,
	    SPEED: 5,
	    TEXT_COLOR: '#FFFFFF',
	    TEXT_BORDER: '#000000',
	    TEXT_BORDER_SIZE: 3,
	    DEFAULT_SIZE: 20,
	    DEFAULT_COLOR: 0x00FF00
	};

	exports.ENEMY_CONFIG = {
	    BORDER: 5,
	    SPEED: 5,
	    TEXT_COLOR: '#FFFFFF',
	    TEXT_BORDER: '#000000',
	    TEXT_BORDER_SIZE: 3,
	    DEFAULT_SIZE: 20,
	    DEFAULT_COLOR: 0xFF0000
	};

	// Game config
	exports.GAME_WIDTH = 3000;
	exports.GAME_HEIGHT = 3000;

    // Key config
	exports.KEY_SHIFT = 16;

	exports.KEY_LEFT = 37;
	exports.KEY_UP = 38;
	exports.KEY_RIGHT = 39;
	exports.KEY_DOWN = 40;

	exports.KEY_W = 87;
	exports.KEY_S = 83;
	exports.KEY_A = 65;
	exports.KEY_D = 68;
	exports.KEY_P = 80;

	// Misc config
	exports.DIR = [{x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}];
	exports.BLOCK_SIZE = 60;
	exports.BUILD_LIM = 200;
	exports.FOG_RANGE = 350;

	//Depth
	exports.MAP_DEPTH = 1;
	exports.BULLET_DEPTH = 2;
	exports.BLOCK_DEPTH = 3;
	exports.PLAYER_DEPTH = 4;
	exports.TEXT_DEPTH = 5;

	//make register function for command
	//enum
	//make register function for command

	exports.COMMAND_TYPE = {INIT: 0, DESTROY: 1, KEYBOARD: 2, MOUSE: 3, MOUSEBUILD: 4, UPDATE: 5, SHOOT: 6, PING: 7};
	exports.PACK = [
		{id: 'Int32', x: 'Int32', y: 'Int32', main: 'Int32'}, //INIT
		{id: 'Int32'}, //DESTROY
		{id: 'Int32', key: 'Uint8'},  //KEYBOARD
		{id: 'Int32', x1: 'Float32', y1: 'Float32', x2: 'Float32', y2: 'Float32', stime: 'Int32'}, //MOUSE
		{x: 'Float32', y: 'Float32'}, //MOUSE BUILD BLOCK
		{id: 'Int32', x: 'Float32', y: 'Float32'}, //UPDATE
		{id: 'Int32', stime: 'Int32', x1: 'Float32', y1: 'Float32', dx: 'Float32', dy: 'Float32'}, //SHOOT
		{stime: 'Int32'} //PING
	];

})(typeof exports === 'undefined'? this.constant = {}: exports);

//Client only

//Server only
if (typeof exports !== 'undefined' )
{
};