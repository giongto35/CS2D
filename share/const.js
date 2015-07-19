'use strict';

//Constants

//Shared
(function(exports){

	// Game config
	exports.GAME_WIDTH = 10000;
	exports.GAME_HEIGHT = 10000;

    // Key config
	exports.KEY_LEFT = 37;
	exports.KEY_UP = 38;
	exports.KEY_RIGHT = 39;
	exports.KEY_DOWN = 40;

	//make register function for command
	//enum
	exports.COMMAND_TYPE = {INIT: 0, DESTROY: 1, KEYBOARD: 2, MOUSE: 3, UPDATE: 4, SHOOT: 5};
	exports.PACK = [
		{id: 'Int32', x: 'Int32', y: 'Int32', main: 'Int32'}, //INIT
		{id: 'Int32'}, //DESTROY
		{id: 'Int32', key: 'Uint8'},  //KEYBOARD
		{id: 'Int32', x1: 'Float32', y1: 'Float32', x2: 'Float32', y2: 'Float32'}, //MOUSE
		{id: 'Int32', x: 'Float32', y: 'Float32'}, //UPDATE
		{id: 'Int32', stime: 'Int32', x1: 'Float32', y1: 'Float32', dx: 'Float32', dy: 'Float32'} //SHOOT
	];

})(typeof exports === 'undefined'? this.constant = {}: exports);

//Client only

//Server only
if (typeof exports !== 'undefined' )
{
	exports.DIR = [{x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}];
};