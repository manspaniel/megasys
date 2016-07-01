var async = require('async');
var path = require('path');
var extend = require('extend');
var KEYCODES = require('./keycodes');

var minimist = require('minimist');
var shellParse = require('shell-quote').parse;

var Program = function() {
	
	this.inputBuffer = "";
	this.inputPosition = 0;
	
	this.currentSequenceItem = null;
	this.currentSequence = null;
	this.sequenceStack = [];
	
	this.promptChar = " > ";
	
	this.args = null;
	this.computer = null;
	this.session = null;
	this.server = null;
	this.sessionState = {};
	
};

Program.prototype.init = function() {
	if(this.invalid) {
		this.session.sendCommand("addTextAtCursor", {
			text: "Invalid program"
		});
		this.session.sendCommand("carriageReturn");
		this.exit();
	}
};

Program.prototype.beforeExit = function() {
	
};

Program.prototype.exit = function() {
	this.beforeExit();
	this.session.programEnded(this);
};

Program.prototype.resume = function() {
	// Called when a program resumes from the stack
};

Program.prototype.resolvePath = function(dir, sessionState) {
	return this.computer.resolvePath(dir, sessionState || this.sessionState);
};

Program.prototype.showHelp = function() {
	if(this.help) {
		for(var k in this.help) {
			this.session.printLine(this.help[k]);
		}
	}
};

Program.prototype._interceptKeypress = function(e) {
	this.interceptKeypress(e);
};

Program.prototype.interceptKeypress = function(e) {
	
	if(this._onKeyDown) {
		this._onKeyDown(e);
		return;
	}
	
	if(e.keyCode == KEYCODES.ENTER) {
		// They hit enter
		var value = this.inputBuffer;
		this.session.sendCommand('carriageReturn');
		this.inputBuffer = "";
		this.inputPosition = 0;
		this._interceptLine(value);
	} else if(e.keyCode == KEYCODES.BACKSPACE) {
		// Backspace
		console.log("Position/buffer", this.inputPosition, this.inputBuffer);
		if(this.inputPosition > 0) {
			this.inputBuffer = this.inputBuffer.substr(0, this.inputPosition-1) + this.inputBuffer.substr(this.inputPosition);
			this.inputPosition--;
			this.session.sendCommand('moveCursorLeft');
			this.session.sendCommand('addTextAtCursor',  {
				text: this.inputBuffer.substr(this.inputPosition) + ' '
			});
		}
	} else if(e.keyCode == KEYCODES.DELETE) {
		// Backspace
		this.inputBuffer = this.inputBuffer.substr(0, this.inputPosition) + this.inputBuffer.substr(this.inputPosition + 1);
		this.session.sendCommand('addTextAtCursor',  {
			text: this.inputBuffer.substr(this.inputPosition) + ' '
		});
	} else if(e.keyCode == KEYCODES.LEFT) {
		// Left arrow
		if(this.inputPosition > 0) {
			this.inputPosition--;
			this.session.sendCommand('moveCursorLeft');
		}
	} else if(e.keyCode == KEYCODES.RIGHT) {
		// Right arrow
		if(this.inputPosition < this.inputBuffer.length) {
			this.inputPosition++;
			this.session.sendCommand('moveCursorRight');
		}
	} else if(e.keyCode == 75 && e.ctrlKey) {
		// Clear the screen (CTRL+K);
		this.session.sendCommand('clearScreen');
		console.log("Clearing screen");
	} else if(e.character && e.character.length) {
		// Some kinda character
		console.log("This is", this.inputBuffer, this.inputPosition);
		this.inputBuffer = this.inputBuffer.substr(0, this.inputPosition) + e.character[0] + this.inputBuffer.substr(this.inputPosition);
		this.session.sendCommand('addTextAtCursor', {
			text: this.inputBuffer.substr(this.inputPosition)
		});
		console.log("Sending", this.inputBuffer.substr(this.inputPosition));
		this.inputPosition++;
		this.session.sendCommand('moveCursorRight');
	}
	
	
};

Program.prototype.clearInput = function() {
	
	var spaces = this.inputBuffer.length;
	var str = "";
	for(var k = 0; k < this.inputBuffer.length; k++) {
		str += " ";
	}
	
	if(this.inputPosition) {
		this.session.sendCommand('moveCursorLeft', {
			cols: this.inputPosition
		});
	}
	
	this.session.sendCommand('addTextAtCursor',  {
		text: str
	});
	
	this.inputBuffer = '';
	this.inputPosition = 0;
	
};

Program.prototype.setInput = function(str) {
	
	// Ensure we have a string
	if(str === null || str === undefined) str = "";
	str = String(str);
	
	// Clear current value, rewind
	this.clearInput();
	
	// Update value, redraw
	this.inputBuffer = str;
	this.inputPosition = str.length;
	this.session.sendCommand('addTextAtCursor',  {
		text: str
	});
	if(str.length) {
		this.session.sendCommand('moveCursorRight', {
			cols: str.length
		});
	}
	
};

Program.prototype._interceptLine = function(text) {
	if(this._onLineInput) {
		console.log("Intercepted", text);
		this._onLineInput(text);
	} else {
		this.interceptLine(text);
	}
};

Program.prototype.interceptLine = function(text) {
	console.log("GOT LINE", text);
};

Program.prototype.printLine = function(text) {
	this.session.printLine(text);
};

Program.prototype.errorLine = function(text) {
	this.printLine(this.name+"; "+text);
};

Program.prototype.promptKey = function(text, callback) {
	var self = this;
	self.printLine(text);
	self._onKeyDown = function(e) {
		self._onKeyDown = null;
		callback(e);
	};
};

Program.prototype.prompt = function(text, defaultValue, callback) {
	
	if(typeof defaultValue == 'function') {
		callback = defaultValue;
		defaultValue = "";
	}
	if(typeof defaultValue != 'string') {
		defaultValue = "";
	}
	
	var self = this;
	
	this.inputPosition = 0;
	this.inputBuffer = '';
	
	var msg = text + (defaultValue ? ' ('+defaultValue+')' : '') + this.promptChar;
	
	var textObject = self.server.parseTextStyle(msg);
	
	this.session.sendCommand("addTextAtCursor", {
		text: textObject
	});
	console.log("Object length",textObject,textObject[0].length);
	this.session.sendCommand('moveCursorRight', {
		cols: textObject[textObject.length-1].length
	});
	
	this._onLineInput = function(text) {
		self._onLineInput = null;
		if(text === "") text = defaultValue;
		console.log("Responding with", text);
		callback(text);
	};
	
};

Program.prototype.runSequence = function(sequence, callback) {
	
	var self = this;
	
	if(this.currentSequence) {
		this.sequenceStack.push(this.currentSequence);
	}
	
	this.currentSequence = {
		currentIndex: -1,
		callback: callback,
		items: sequence.map(function(item) {
			return extend({
				program: self,
				session: self.session,
				init: function() {
					// Override me
				},
				done: function() {
					self.runNextSequenceItem();
				}
			}, self.server.sequenceTypes[item.type || 'text'] , item);
		}),
		working: {}
	};
	
	self.runNextSequenceItem();
	
};

Program.prototype.runNextSequenceItem = function() {
	
	var self = this;
	
	var sequence = this.currentSequence;
	
	if(sequence) {
		
		// Jump to the next item
		sequence.currentIndex++;
		
		// Have we just completed the sequence?
		if(sequence.currentIndex >= sequence.items.length) {
			this.currentSequence = this.sequenceStack.pop();
			if(sequence.callback) {
				sequence.callback();
			}
			return;
		}
		
		// Run the next item
		var item = this.currentSequenceItem = sequence.items[sequence.currentIndex];
		
		item.init();
		
	}
	
};

Program.prototype.sendCommand = function(name, args) {
	if(!this.dead) {
		this.session.sendCommand(name, args);
	}
};

Program.prototype._parseCommandString = function(cmd) {
	
	var cmdParts = shellParse(cmd.replace(/(^\s+|\s+$)/, ''));
	var programName = cmdParts[0];
	var args = minimist(cmdParts.slice(1));
	
	return {
		programName: programName,
		args: args
	};
	
};

module.exports = Program;