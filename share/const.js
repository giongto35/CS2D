'use strict';

//Constants

//Shared
(function(exports){

    // your code goes here

	exports.KEY_LEFT = 37;
	exports.KEY_UP = 38;
	exports.KEY_RIGHT = 39;
	exports.KEY_DOWN = 40;

	//make register function for command
	exports.COMMAND_TYPE = {INIT: 0, KEYBOARD: 1, MOUSE: 2, UPDATE: 3, SHOOT: 4};
	exports.PACK = [
		{id: 'Int32', x: 'Int32', y: 'Int32'},
		{id: 'Int32', key: 'Uint8'}, 
		{id: 'Int32', x: 'Float32', y: 'Float32'},
		{id: 'Int32', x: 'Float32', y: 'Float32'},
		{x1: 'Float32', y1: 'Float32', x2: 'Float32', y2: 'Float32'}
	];

})(typeof exports === 'undefined'? this.constant = {}: exports);

//Client only

//Server only
if (typeof exports !== 'undefined' )
{
	exports.DIR = [{x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}];
};