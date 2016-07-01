define(["/socket.io/socket.io.js"], function(io) {
	
	var KEYCODES = {
		"BACKSPACE": 8,
		"COMMA": 188,
		"DELETE": 46,
		"DOWN": 40,
		"END": 35,
		"ENTER": 13,
		"ESCAPE": 27,
		"HOME": 36,
		"LEFT": 37,
		"PAGE_DOWN": 34,
		"PAGE_UP": 33,
		"PERIOD": 190,
		"RIGHT": 39,
		"SPACE": 32,
		"TAB": 9,
		"UP": 38
	};
	
	var KEYSTOSEND = [KEYCODES.ENTER, KEYCODES.BACKSPACE, KEYCODES.DELETE, KEYCODES.LEFT, KEYCODES.RIGHT, KEYCODES.UP, KEYCODES.DOWN, KEYCODES.TAB, KEYCODES.ESCAPE];
	
	var Terminal = function() {
		
		var self = this;
		
		// Size of the terminal (should remain fixed after sart)
		self.rows = 24;
		self.cols = 80;
		
		// The current cursor position
		self.cursorPos = [0, 0];
		self.cursorIsEnabled = false;
		self.cursorIsVisible = false;
		
		// Render control
		self.needsRender = false;
		
		// The character matrix. Each cell contains a character, and a render value (bit field which controls colour/render style)
		self.matrix = null;
		
		// Screen state stack
		self.screenStateStack = [];
		
		// Socket stuff
		self.socket = null
		
		var getPosIndex = function(x, y) {
			if(arguments.length == 1) {
				x = arguments[0][0];
				y = arguments[0][1];
			}
			if(arguments.length == 0) {
				x = self.cursorPos[0];
				y = self.cursorPos[1];
			}
			return (y * self.cols * 2) + x * 2;
		}
		
		self.commands = {
			greet: function() {
				self.socket.emit('greet', {
					browser: navigator.userAgent,
					sessionID: localStorage.getItem('sessionHash')
				});
			},
			setSession: function(args) {
				console.log("Setting session has to", args.sessionHash)
				localStorage.setItem('sessionHash', args.sessionHash);
			},
			clear: function(args) {
				self.clear();
				self.cursorPos[0] = 0;
				self.cursorPos[1] = 0;
				self.setNeedsRender();
			},
			setCursor: function(args) {
				self.cursorPos[0] = args[0];
				self.cursorPos[1] = args[1];
				self.resetCursorBlink();
				self.setNeedsRender();
			},
			addTextAtCursor: function(args) {
				var index = getPosIndex();
				self.addTextAtIndex(index, args.text, true, args.moveCursor || false);
			},
			printLine: function(args) {
				var index = getPosIndex();
				self.addTextAtIndex(index, args.text, true, true);
				self.carriageReturn();
			},
			addTextAtPos: function(args) {
				var index = getPosIndex(args.pos.x, args.pos.y);
				self.addTextAtIndex(index, args.text);
			},
			setCursorPos: function(args) {
				self.cursorPos = args.pos;
				self.cursorStyle = Number(args.style) || 0;
				self.resetCursorBlink();
				self.setNeedsRender();
			},
			moveMatrixUp: function(args) {
				self.moveMatrixUp(args.rows);
			},
			moveCursorLeft: function(args) {
				self.offsetCursor(-(args.cols || 1));
			},
			moveCursorRight: function(args) {
				self.offsetCursor(args.cols || 1);
			},
			carriageReturn: function() {
				self.carriageReturn();
			},
			clearScreen: function() {
				self.clearPreviousLines();
			},
			setCursorVisible: function(args) {
				self.setCursorVisible(args.state);
			},
			pushScreenState: function() {
				
				console.log("Pushing state");
				
				// Push existing state to stack
				self.screenStateStack.push({
					cursorPos: self.cursorPos,
					cursorIsEnabled: self.cursorIsEnabled,
					cursorIsVisible: self.cursorIsVisible,
					cursorStyle: self.cursorStyle,
					matrix: self.matrix
				});
				
				// Reset state
				self.cursorPos = [0, 0];
				self.cursorIsEnabled = false;
				self.cursorIsVisible = false;
				self.cursorStyle = 0;
				self.clear();
				
			},
			popScreenState: function() {
				
				var state = self.screenStateStack.pop();
				
				if(state) {
					self.cursorPos = state.cursorPos,
					self.cursorIsEnabled = state.cursorIsEnabled,
					self.cursorIsVisible = state.cursorIsVisible,
					self.cursorStyle = state.cursorStyle;
					self.matrix = state.matrix;
				}
				
			}
		}
		
		self.addTextAtIndex = function(index, text, cursorFollowsOverflow, moveCursorToEnd) {

			var rowSize = self.cols * 2;
			var maxSize = self.cols * self.rows * 2;
			
			// Handle array of text lines
			if(Array.isArray(text)) {
				for(var k in text) {
					var segment = text[k];
					index = self.addTextAtIndex(index, segment, cursorFollowsOverflow, moveCursorToEnd);
					index = Math.floor(index/rowSize + 1) * rowSize
				}
				return index;
			}
			
			var styles = null;
			
			if(typeof text == 'object') {
				styles = text.styles;
				text = text.text;
			}
			
			text = text || "";
			
			var startY = Math.floor(index / rowSize);
			var startX = (index - startY * rowSize) / 2;
			
			var totalRows = Math.ceil((startX * 2 + text.length * 2) / rowSize);
			
			if(totalRows + startY > self.rows) {
				var rowOverflow = totalRows + startY - self.rows;
				self.moveMatrixUp(rowOverflow, cursorFollowsOverflow);
				index -= rowOverflow * rowSize;
			}
			
			var style = 0
			for(var k = 0; k < text.length; k++) {
				self.matrix[index] = text[k];
				if(styles) {
					self.matrix[index+1] = styles[k] || 0;
				}
				index += 2;
			}
			
			if(moveCursorToEnd) {
				self.cursorPos[1] = Math.floor(index / rowSize);
				self.cursorPos[0] = (index - self.cursorPos[1] * rowSize) / 2;
			}
			
			self.setNeedsRender();
			
			return index;
		}
		
		self.moveMatrixUp = function(rows, cursorFollowsOverflow) {
			var newMatrix = getBlankMatrix();
			var offset = getPosIndex(0, (rows || 1));
			var index = 0;
			for(var y = 0; y < self.rows; y++) {
				for(var x = 0; x < self.cols; x++) {
					var oldIndex = index + offset;
					if(oldIndex >= 0 && oldIndex < self.rows * self.cols * 2) {
						newMatrix[index] = self.matrix[oldIndex];
						newMatrix[index+1] = self.matrix[oldIndex+1];
					}
					index += 2;
				}
			}
			self.matrix = newMatrix;
			if(cursorFollowsOverflow) {
				self.cursorPos[1] -= rows;
				if(self.cursorPos[1] < 0) self.cursorPos[1] = 0;
			}
			self.setNeedsRender();
		}
		
		self.offsetCursor = function(offset) {
			self.cursorPos[0] += offset;
			if(self.cursorPos[0] < 0) {
				self.cursorPos[0] = self.cols - 1;
				self.cursorPos[1]--;
				if(self.cursorPos[1] < 0) self.cursorPos[1] = 0;
			}
			if(self.cursorPos[0] > self.cols - 1) {
				self.carriageReturn();
			}
			self.resetCursorBlink();
		}
		
		self.carriageReturn = function() {
			self.cursorPos[0] = 0;
			self.cursorPos[1]++;
			if(self.cursorPos[1] >= self.rows) {
				self.cursorPos[1] = self.rows - 1;
				self.moveMatrixUp();
			}
			self.resetCursorBlink();
		}
		
		var getBlankMatrix = function() {
			return new Array(self.rows * self.cols * 2);
		}
		
		var blinkCursor = function() {
			self.cursorIsVisible = !self.cursorIsVisible;
			self.setNeedsRender();
		}
		
		var cursorBlinkInterval;
		self.setCursorVisible = function(visible) {
			self.cursorIsEnabled = visible ? true : false;
			self.cursorIsVisible = self.cursorIsEnabled;
			console.log(self.cursorIsVisible);
			clearInterval(cursorBlinkInterval);
			if(self.cursorIsEnabled) {
				cursorBlinkInterval = setInterval(blinkCursor, 800);
			}
			self.setNeedsRender();
		}
		
		self.resetCursorBlink = function() {
			if(self.cursorIsEnabled) {
				self.setCursorVisible(true);
			}
		}
		
		self.setNeedsRender = function() {
			self.needsRender = true;
		}
		
		self.clear = function() {
			self.matrix = getBlankMatrix();
		}
		
		self.clearPreviousLines = function() {
			if(self.cursorPos[1] > 0) {
				self.moveMatrixUp(self.cursorPos[1]);
				self.cursorPos[1] = 0;
			}
		}
		
		self.runCommand = function(name, args) {
			if(self.commands[name]) {
				self.commands[name](args);
			} else {
				console.log("Server sent unknown command '"+name+"'");
			}
		}
		
		self.runCommandSet = function(set) {
			for(var k in set) {
				self.runCommand(set[k].name, set[k].args);
			}
		}
		
		self.init = function() {
		
			self.clear();
			self.setCursorVisible(true);
			
			self.socket = io();
			
			// Intercept commands
			self.socket.on('cmd', function(event) {
				self.runCommand(event.name, event.args || {});
			});
			
			// On keydown, check for special keys
			window.addEventListener('keydown', function(e) {
				
				// Ignore return
				if(e.keyCode == 82) return;
				
				if(KEYSTOSEND.indexOf(e.keyCode) > -1 || e.ctrlKey || e.metaKey || e.altKey) {
					
					// Listen for these keys
					self.socket.emit('keypress', {
						keyCode: e.keyCode,
						character: '',
						ctrlKey: e.metaKey || e.ctrlKey,
						altKey: e.altKey,
						shiftKey: e.shiftKey
					});
					e.preventDefault();
				}
				
			});
			
			// On keypress, send to the server
			window.addEventListener('keypress', function(e) {
				
				self.socket.emit('keypress', {
					character: String.fromCharCode(e.keyCode),
					ctrlKey: e.metaKey || e.ctrlKey,
					altKey: e.altKey,
					shiftKey: e.shiftKey
				});
				e.preventDefault();
				
			});
			
		}
		
	}
	
	return Terminal;
	
});