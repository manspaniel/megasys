var KEYCODES = require('../keycodes');
var printf = require('printf');

module.exports = function(server) {
	
	server.defineProgram("read", {
		help: [
			"Displays text files",
			"Usage:   read <filename>"
		],
		init: function() {
			
			var self = this;
			
			// Exit if no file given
			if(this.args._.length == 1) {
				
				var file = this.computer.getNode(this.args._[0], this.sessionState);
				console.log("About to read file", file);
				if(file) {
					this.computer.getFileContents(file, this.sessionState, function(err, contents) {
						if(err) {
							self.errorLine(err);
							self.exit();
						} else {
							self.setContents(contents, file);
						}
					});
				} else {
					self.errorLine("File not found.");
					self.exit();
					return;
				}
				
			} else if(this.args._.length > 1) {
				self.errorLine("Too many arguments.");
				self.exit();
			}
			
		},
		beforeExit: function() {
			if(this.hasPushedScreen) {
				this.session.sendCommand('popScreenState');
			}
		},
		setContents: function(text, file) {
			
			var self = this;
			self.hasPushedScreen = true;
			self.sendCommand('pushScreenState');
			self.sendCommand('setCursorVisible', {state: true});
			self.sendCommand('setCursorPos', {
				pos: [0, 0],
				style: 1
			});
			
			self.state = {
				text: text,
				lines: [],
				file: file,
				scrollLine: 0,
				currentLine: 0,
				currentCol: 0,
				cursorAfter: false,
				targetCol: 0
			};
			
			this.buildLines();
			this.printToolbar();
			this.printText();
			
		},
		buildLines: function() {
			
			var self = this;
			
			self.state.lines = server.parseTextStyle(self.state.text, /(\n|[^\n]{0,80})/g);
			
			for(var k in self.state.lines) {
				console.log(self.state.lines[k].wraps+" "+self.state.lines[k].text);
			}
			
		},
		printText: function(startLine) {
			
			var state = this.state;
			
			// Figure out which line in the document we're gonna start printing from
			startLine = Math.max(state.scrollLine, startLine || 0);
			
			// Figure out which line on the screen our first line will be displayed on
			var startRow = startLine - state.scrollLine;
			
			for(var k = 0; k < 22 - startRow; k++) {
				var line = state.lines[k + startLine];
				if(line) {
					this.sendCommand('addTextAtPos', {
						text: {
							text: printf('% -80s', line.text),
							length: 80,
							styles: line.styles
						},
						pos: {x:0, y: k + startLine - state.scrollLine}
					});
				}
			}
			
		},
		_interceptKeypress: function(e) {
			
			if(e.keyCode == KEYCODES.UP) {
				if(e.shiftKey) {
					this.state.scrollLine--;
					this.moveCursor(0, 0);
				} else {
					this.moveCursor(0, -1);
				}
			} else if(e.keyCode == KEYCODES.DOWN) {
				if(e.shiftKey) {
					this.state.scrollLine++;
					this.moveCursor(0, 0);
				} else {
					this.moveCursor(0, 1);
				}
			} else if(e.keyCode == KEYCODES.LEFT) {
				this.moveCursor(-1, 0);
			} else if(e.keyCode == KEYCODES.RIGHT) {
				this.moveCursor(1, 0);
			} else if(e.keyCode == KEYCODES.ESCAPE) {
				this.exit();
			} else if(e.keyCode == KEYCODES.BACKSPACE) {
				this.deleteCharacter(true);
			} else if(e.keyCode == KEYCODES.DELETE) {
				this.deleteCharacter(false);
			} if(e.character && e.character.length) {
				this.addTextAtCursor(e.character);
			}
			
		},
		deleteCharacter: function(isBackspace) {
			
			var self = this;
			
			var x = this.state.currentCol;
			var y = this.state.currentLine;
			
			var line = this.state.lines[y];
			var previousLineWraps = this.state.lines[y + 1].wraps;
			
			if(this.state.cursorAfter) {
				this.state.cursorAfter = false;
				x++;
			}
			
			var cursorNeedsMoving = true;
			
			// Delete the character
			// if(x === 0 && y > 0) {
			// 	if(previousLineWraps) {
			// 		x = 79;
			// 		y--;
			// 		line = this.state.lines[y];
			// 	} else {
			// 		
			// 	}
			// }
			
			console.log("A");
			
			// Either:
			// - Line is empty and doesn't wrap, and should just delete the line and go to the previous line
			// - Line is not empty and doesn't wrap, so append the contents of this line to the previous line and delete this line (then handle overflow)
			// - Line is not empty and DOES wrap, so do as normal
			
			if(isBackspace && x === 0 && line.wraps === false && previousLineWraps === false) {
				
				// Delete this row, appending contents to the previous line
				this.moveCursor(-1, 0, false, false);
				var previousLine = this.state.lines[y - 1];
				this.state.lines.splice(y, 1);
				
				previousLine.text = previousLine.text.substr(0, previousLine.text.length) + line.text;
				previousLine.styles = previousLine.styles.slice(0, previousLine.text.length).concat(line.styles);
				
				this.updateOverflow(y-1);
				this.printText(y-2);
				
				console.log("FFFF");
				
			} else {
				
				line.text = this.state.lines[y].text.substr(0, x - 1) + this.state.lines[y].text.substr(x);
				line.styles.splice(x - 1, 1);
				
				// Flow text forward, while 
				for(var row = y; row < this.state.lines.length; row++) {
					var thisLine = this.state.lines[row];
					var nextLine = this.state.lines[row + 1];
					
					console.log("C");
					
					if(!nextLine) break;
					
					console.log("D");
					
					if(thisLine.wraps) {
						
						var nextLineHadText = nextLine.text.length ? true : false;
						
						// Shift character from next line to this line
						thisLine.text += nextLine.text.substr(0, 1);
						nextLine.text = nextLine.text.substr(1);
						thisLine.styles.push(nextLine.styles.shift());
						
						// If this line wraps into a non-wrapping EMPTY line 
						if(nextLineHadText && nextLine.text.length === 0 && thisLine.wraps === true && nextLine.wraps === false) {
							
							// Remove line, and de-wrap
							this.state.lines.splice(row + 1, 1);
							thisLine.wraps = false;
							
						}
						
					} else {
						
						break;
						
					}
					
				}
				
				if(cursorNeedsMoving) {
					console.log("BBBB");
					this.moveCursor(-1, 0, false, true);
				} else {
					console.log("AAAA");
					this.printText(y-1);
				}
				
			}
			
			for(var k in self.state.lines) {
				console.log(self.state.lines[k].wraps+" "+self.state.lines[k].text);
			}
			
		},
		addTextAtCursor: function(text) {
			
			var self = this;
			
			// Add the text to this line, ignoring overflow
			var line = this.state.lines[self.state.currentLine];
			var cursorWasAfter = self.state.cursorAfter;
			
			if(cursorWasAfter) {
				self.state.currentCol++;
			}
			
			// Inject the text segment
			line.text = line.text.substr(0, self.state.currentCol) + text + line.text.substr(self.state.currentCol);
			
			// Build and inject style segment
			var style = [];
			for(var k = 0; k < text.length; k++) {
				style.push(0);
			}
			line.styles.splice(self.state.currentCol, 0, style);
			
			// Update the overflow
			this.updateOverflow(self.state.currentLine);
			
			this.printText(self.state.currentLine);
			this.moveCursor(text.length, 0, false, false);
			
			if(cursorWasAfter) {
				this.moveCursor(1, 0);
			}
			
		},
		updateOverflow: function(start) {
			
			var self = this;
			var state = self.state;
			
			var overflowText, overflowStyle;
			var k = start;
			while(k < state.lines.length) {
				var line = state.lines[k++];
				
				if(overflowText) {
					// Previous line is overflowing onto this line
					line.text = overflowText + line.text;
					line.styles.splice(0, 0, overflowStyle);
					overflowText = null;
					overflowStyle = null;
				}
				
				if(line.text.length > 80) {
					
					// This line overflows.
					overflowText = line.text.substr(80);
					line.text = line.text.substr(0, 80);
					
					overflowStyle = line.styles.splice(80);
					
					if(line.wraps === false) {
						line.wraps = true;
						
						console.log("Splicing in new line");
						state.lines.splice(k, 0, {
							text: overflowText,
							styles: overflowStyle,
							wraps: false
						});
						overflowText = null;
						overflowStyle = null;
						
					}
					
				} else {
					
					break;
					
				}
			}
			
		},
		sendCursorUpdate: function() {
			this.sendCommand('setCursorPos', {
				pos: [
					this.state.currentCol,
					this.state.currentLine - this.state.scrollLine
				],
				style: this.state.cursorAfter ? 2 : 1
			});
		},
		moveCursor: function(x, y, cursorAfter, updateText) {
			
			var state = this.state;
			
			console.log("Column is "+state.currentCol+(state.cursorAfter?"b":''));
			
			if(x === 1 && y === 0 && state.currentCol === 79 && state.cursorAfter === false) {
				// On last character of the line, going past the last character
				console.log("Putting cursor after");
				state.currentCol = 79;
				state.cursorAfter = true;
				this.sendCursorUpdate();
				return;
			} else if(x === -1 && y === 0 && state.currentCol == 79 && state.cursorAfter === true) {
				// Just past the last character of the line, going back to the last character
				console.log("Putting cursor before");
				state.currentCol = 79;
				state.cursorAfter = false;
				this.sendCursorUpdate();
				return;
			} else if(x === -1 && y === 0 && state.currentCol == 0 && state.cursorAfter === false && state.currentLine > 0 && state.lines[state.currentLine-1].text.length === 80) {
				// On the first character of a line
				state.currentCol = 79;
				state.currentLine--;
				state.cursorAfter = true;
				this.sendCursorUpdate();
				return;
			} else if(y === 0) {
				state.cursorAfter = false;
			}
			
			if(x) {
				state.currentCol += x;
				var lineLength = state.lines[state.currentLine].text.length;
				if(state.currentCol > lineLength || state.currentCol == 80) {
					state.currentCol = 0;
					y++;
				}
				if(state.currentCol < 0) {
					if(state.currentLine > 0) {
						state.currentCol = 79;
						y--;
					} else {
						state.currentCol = 0;
						y = 0;
					}
				}
			}
			if(y) {
				state.currentLine += y;
				state.currentLine = Math.max(0, Math.min(state.lines.length-1, state.currentLine));
				var lineLength = state.lines[state.currentLine].text.length;
				if(state.currentCol >= lineLength) {
					state.currentCol = lineLength;
				}
			}
			
			state.scrollLine = Math.max(0, Math.min(state.lines.length-1 - 21, state.scrollLine));
			
			if(state.currentLine > state.scrollLine + 21) {
				state.scrollLine = state.currentLine - 21;
			}
			if(state.currentLine < state.scrollLine) {
				state.scrollLine = state.currentLine;
			}
			
			this.sendCursorUpdate();
			
			// Send the updated text if scrolling as occurred
			if(updateText !== false) {
				this.printText();
			}
		},
		printToolbar: function() {
			
			var toolLabel = "Save: CTRL+S, Exit: ESC";
			
			toolbarLabel = printf('% -80s', this.state.file.name+" - "+toolLabel);
			
			this.sendCommand('addTextAtPos', {
				text: server.parseTextStyle("%GREEN|INVERTED%"+toolbarLabel),
				pos: {x:0,y: 22}
			});
			
		}
	});
	
}