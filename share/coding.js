/*jslint node: true */
'use strict';

//for Server
var isServer = false;

if (typeof exports !== 'undefined') {
	isServer = true;
	var constant = require('./const.js');	
}	

(function(exports){

	// isServer = (typeof exports !== 'undefined');
	console.log(isServer);

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

	exports.decrypt = function (ab) {
		//keyboard
		var res = {};
		var dv;
		if (isServer) {
			dv = new DataView(toArrayBuffer(ab));
		} else {
			dv = new DataView(ab);
		}
		var op = dv.getUint8(0);
		var offset = 1;

		res.command = op;
		for (var m in constant.PACK[op]) {
			switch (constant.PACK[op][m]) {
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
	};

	exports.encrypt = function (data) {
		var cnt = 1; //Opcode
		var op = data.command;
		for (var m in constant.PACK[op]) {
			switch(constant.PACK[op][m]) {
				case 'Uint8':
					cnt += 1;
					break;
				case 'Int8':
					cnt += 1;
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
		for (m in constant.PACK[op]) {
			switch(constant.PACK[op][m]) {
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
		if (isServer) {
			return toBuffer(res);
		} else {
			return res;
		}
	}

})(typeof exports === 'undefined'? this.coding = {}: exports);
