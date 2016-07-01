var async = require('async');
var path = require('path');

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

module.exports = function(server) {
	
	server.defineProgram("shell", {
		promptChar: "$ ",
		init: function() {
			
			this.doPrompt();
			
			this.history = [];
			
		},
		resume: function() {
			this.doPrompt();
		},
		doPrompt: function() {
			
			var self = this;
			
			var wd = this.sessionState.directory;
			var home = this.sessionState.home.replace(/\/$/, '');
			console.log("WD", wd);
			console.log("HOME", home);
			if(wd.indexOf(home) === 0) {
				wd = path.join("~/", this.sessionState.directory.substr(home.length));
			}
			self.prompt("%CYAN%"+this.sessionState.user+"%NORMAL%@%GREEN%"+this.computer.hostname+":%YELLOW%"+wd+"%NORM%", function(value) {
				self.runCommand(value);
			});
			
		},
		_interceptKeypress: function(e) {
			if(e.keyCode == KEYCODES.UP) {
				this.historyIndex--;
				if(this.historyIndex < 0) this.historyIndex = 0;
				this.setInput(this.history[this.historyIndex]);
			} else if(e.keyCode == KEYCODES.DOWN) {
				this.historyIndex++;
				if(this.historyIndex >= this.history.length) this.historyIndex = this.history.length;
				this.setInput(this.history[this.historyIndex]);
			} else if(e.keyCode == KEYCODES.TAB) {
				this.predictFile();
			} else {
				this.interceptKeypress(e);
			}
		},
		runCommand: function(cmd) {
			
			var self = this;
			
			self.history.push(cmd);
			self.historyIndex = self.history.length;
			
			// Parse input
			var cmdParts = this._parseCommandString(cmd);
			var programName = cmdParts.programName;
			var args = cmdParts.args;
			
			if(!programName) {
				self.doPrompt();
				return;
			}
			
			// Build a list of search paths
			var directories = [];
			directories.push("./");
			for(var k in this.sessionState.$path) {
				directories.push(this.sessionState.$path[k]);
			}
			
			var foundProgram = false;
			
			// If the program exists in the current directory, or an absolute path was specified, we can find it with getNode
			var node = this.computer.getNode(programName, this.sessionState);
			if(node && node.isProgram) {
				// Found it by absolute path!
				programName = node.programName;
				foundProgram = true;
			} else {
				// Otherwise, lets check in $PATH
				for(k in this.sessionState.$path) {
					node = this.computer.getNode(path.join(this.sessionState.$path[k], programName), this.sessionState);
					if(node && node.isProgram) {
						programName = node.programName;
						foundProgram = true;
					}
				}
			}
			
			if(!foundProgram) {
				// Command not found
				self.session.sendCommand("addTextAtCursor", {
					text: "Command not found"
				});
				self.session.sendCommand("carriageReturn");
				self.doPrompt();
			} else {
				// Execute the program!
				var program = self.session.getProgramInstance(programName, args, self.computer, self);
				self.session.pushProgram(program);
			}
			
		},
		predictFile: function() {
			// console.log("TAB WAS PRESSED", this.sessionState.directory);
			// path.
			// var node = console.log();
			
			var self = this;
			
			// Grab the last section of the buffer
			var originalInputBuffer = this.inputBuffer;
			var pathMatch = this.inputBuffer.match(/([^\ ]|\\ )+$/);
			if(!pathMatch) return;
			
			var targetPath = pathMatch[0];
				
			// Pull out the basename from the whole path
			var fileName = path.basename(targetPath);
			
			var currentPath = this.computer.getNode('.', this.sessionState).path;
			
			console.log("$$ currentPath", currentPath);
			console.log("$$ targetPath", targetPath);
			console.log("$$ fileName", fileName);
			console.log("Session state", this.sessionState);
			
			// First try and get a node based on the entire entry
			var finalNode = this.computer.getNode(targetPath, this.sessionState);
			
			var getPath = function(node, add) {
				var output;
				if(targetPath[0] == '/') {
					// Absolute
					output = node.path;
				} else {
					// Relative
					output = node.path;
					var homePath = self.sessionState.home.replace(/\/$/, '');
					if(output.indexOf(homePath) === 0) {
						// Replace user directory with 
						output = path.join('~', output.substr(homePath.length));
					} else {
						// Make it relative to current directory
						output = path.relative(currentPath, output);
					}
				}
				
				if(add) {
					output = path.join(output, add);
				} else if(node.isFolder && output !== "/") {
					output += "/";
				}
				
				output = output.replace(/\ /g, '\\ ');
				return output;
			}
			
			// Did we find a node?
			if(!finalNode || finalNode.isFolder === true) {
				
				// No node was found with that exact name... so time to do a search
				var folderNode = finalNode || this.computer.getNode(path.dirname(targetPath), this.sessionState);
				if(folderNode && folderNode.children) {
					
					// Find
					var matches = [];
					
					for(var k in folderNode.children) {
						var childNode = folderNode.children[k];
						console.log("> Testing", childNode);
						if(childNode.name.indexOf(fileName) === 0 || finalNode) {
							matches.push(childNode);
						}
					}
					
					if(matches.length > 1) {
						
						// Grab a list of names
						var matchNames = matches.map(function(node) {
							return String(node.name);
						});
						
						// Find out the common start string for these matches, if any, so we can predict to the end of that
						var commonString = matchNames[0];
						matchNames.forEach(function(match) {
							for(var index = 0; index <= Math.min(match.length, commonString.length); index++) {
								if(commonString[index] !== match[index]) {
									commonString = commonString.substring(0, index);
									break;
								}
							}
						});
						
						// Figure out the new path. Make it relative to the current directory
						console.log("PATH", this.sessionState.directory, folderNode.path, commonString);
						var newPath = getPath(folderNode, commonString);
						var newBuffer = originalInputBuffer.substr(0, originalInputBuffer.length - targetPath.length) + newPath;
						
						// Multiple matches, print em all and auto-complete up to the most common string
						self.session.sendCommand("carriageReturn");
						self.session.sendCommand("addTextAtCursor", {
							text: matchNames.join('\n'),
							moveCursor: true
						});
						self.session.sendCommand("carriageReturn");
						
						// Show the prompt again
						self.doPrompt();
						self.session.sendCommand("addTextAtCursor", {
							text: newBuffer,
							moveCursor: true
						});
						self.inputBuffer = newBuffer;
						self.inputPosition = newBuffer.length;
						
						return;
						
					} else if(matches.length === 1) {
						
						// One match
						finalNode = matches[0];
						
					}
					
				}
				
			}
			
			if(finalNode) {
				
				var newPath;
				if(finalNode.path === "/") {
					newPath = "/";
				} else {
					newPath = getPath(finalNode);
				}
				var newBuffer = originalInputBuffer.substr(0, originalInputBuffer.length - targetPath.length) + newPath;
				
				this.session.sendCommand('moveCursorLeft', {
					cols: originalInputBuffer.length
				});
				this.session.sendCommand('addTextAtCursor', {
					text: newBuffer,
					moveCursor: true
				});
				this.inputBuffer = newBuffer;
				this.inputPosition = newBuffer.length;
			}

		},
		updateBufferFromPrediction: function(buffer, fileNode, partialName) {
			return buffer + (partialName || fileNode.path);
		}
	});
	
};