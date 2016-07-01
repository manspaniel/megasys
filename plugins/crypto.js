var async = require('async');
var path = require('path');
var printf = require('printf');

module.exports = function(server) {
	
	server.defineProgram("crypto", {
		help: [
			"Encrypt/decrypt files, folders and programs.",
			"Usage:   -e <file>      Encrypt a file",
			"         -d <file>      Decrypt a file"
		],
		init: function() {
			var self = this;
			
			// Exit if no file given
			if(typeof this.args.e == 'string') {
				var file = this.computer.getNode(this.args.e, this.sessionState);
				if(!file) {
					self.session.printLine("Could not encrypt file. File not found.");
				} else if(file.encrypted) {
					self.session.printLine("\""+file.path+"\" is already encrypted. Use %GREEN%crypto -d <file>%NORM% to decrypt.");
				} else {
					self.prompt("Enter a new encryption key", function(val) {
						if(val.length == 0) {
							self.printLine("No key was entered.");
							self.exit();
						} else {
							self.printLine("Encrypting file...");
							file.encrypted = true;
							file.encryptionKey = val;
							setTimeout(function() {
								self.exit();
							}, 1500);
						}
					});
					return;
				}
			} else if(typeof this.args.d == 'string') {
				var file = this.computer.getNode(this.args.d, this.sessionState);
				if(!file) {
					self.session.printLine("Could not decrypt file. File not found.");
				} else if(!file.encrypted) {
					self.session.printLine("\""+file.path+"\" is not encrypted.");
				} else {
					self.prompt("Enter the encryption key", function(val) {
						if(val.length == 0) {
							self.printLine("No key was entered.");
							self.exit();
						} else if(val !== file.encryptionKey) {
							self.printLine("Decrypting file...");
							setTimeout(function() {
								self.printLine("Invalid key.");
								self.exit();
							}, 400);
						} else {
							self.printLine("Decrypting file...");
							file.encrypted = false;
							file.encryptionKey = "";
							setTimeout(function() {
								self.exit();
							}, 1500);
						}
					});
					return;
				}
			} else {
				self.showHelp();
			}
			
			self.exit();
		}
	});
	
	server.defineProgram("mcrack", {
		help: [
			"MEGASYS ENCRYPTION BREAKER.",
			"Type: mcrack <file> to crack."
		],
		init: function() {
			var self = this;
			this.skull = [
				"%GREEN|INVERTED%        .n                   .                 .                  n.          ",
				"%GREEN|INVERTED%  .   .dP                  dP                   9b                 9b.    .   ",
				"%GREEN|INVERTED% 4    qXb         .       dX                     Xb       .        dXp     t  ",
				"%GREEN|INVERTED%dX.    9Xb      .dXb    __                         __    dXb.     dXP     .Xb ",
				"%GREEN|INVERTED%9XXb._       _.dXXXXb dXXXXbo.                 .odXXXXb dXXXXb._       _.dXXP ",
				"%GREEN|INVERTED% 9XXXXXXXXXXXXXXXXXXXVXXXXXXXXOo.           .oOXXXXXXXXVXXXXXXXXXXXXXXXXXXXP  ",
				"%GREEN|INVERTED%  `9XXXXXXXXXXXXXXXXXXXXX'~   ~`OOO8b   d8OOO'~   ~`XXXXXXXXXXXXXXXXXXXXXP'   ",
				"%GREEN|INVERTED%    `9XXXXXXXXXXXP' `9XX'   DIE    `98v8P'  HUMAN   `XXP' `9XXXXXXXXXXXP'     ",
				"%GREEN|INVERTED%        ~~~~~~~       9X.          .db|db.          .XP       ~~~~~~~         ",
				"%GREEN|INVERTED%                        )b.  .dbo.dP'`v'`9b.odb.  .dX(                        ",
				"%GREEN|INVERTED%                      ,dXXXXXXXXXXXb     dXXXXXXXXXXXb.                       ",
				"%GREEN|INVERTED%                     dXXXXXXXXXXXP'   .   `9XXXXXXXXXXXb                      ",
				"%GREEN|INVERTED%                    dXXXXXXXXXXXXb   d|b   dXXXXXXXXXXXXb                     ",
				"%GREEN|INVERTED%                    9XXb'   `XXXXXb.dX|Xb.dXXXXX'   `dXXP                     ",
				"%GREEN|INVERTED%                     `'      9XXXXXX(   )XXXXXXP      `'                      ",
				"%GREEN|INVERTED%                              XXXX X.`v'.X XXXX                               ",
				"%GREEN|INVERTED%                              XP^X'`b   d'`X^XX                               ",
				"%GREEN|INVERTED%                              X. 9  `   '  P )X                               ",
				"%GREEN|INVERTED%                              `b  `       '  d'                               ",
				"%GREEN|INVERTED%                               `             '                                ",
				"%GREEN|INVERTED%                                                                              ",
				"##############################################################################",
				"##                     MEGASYS ENCRYPTION BREAKER v0.2                      ##",
				"##############################################################################",
				"",
			];
			
			// Show logo and intro text
			var index = 0;
			var timer = setInterval(function() {
				self.printLine(self.skull[index]);
				index++;
				if(index == self.skull.length) {
					clearInterval(timer);
					self.doStuff();
				}
			}, 30);
		},
		doStuff: function() {
			
			if(this.args._.length !== 1) {
				this.printLine("Invalid input :/ Use mcrypt <file> to crack encrypted file.");
				this.exit();
				return;
			}
			
			this.file = this.computer.getNode(this.args._[0], this.sessionState);
			
			if(!this.file) {
				this.printLine("File not found, can't decrypt :/");
				return this.exit();
			} else if(!this.file.encrypted) {
				this.printLine("No need to crack, file is already decrypted. Have a nice day!");
				return this.exit();
			} else {
				this.printLine("To begin brute crack attempts press %GREEN%S%NORM%, or press %GREEN%ESC%NORM% or %GREEN%X%NORM% to exit.");
				this.readyForInput = true;
			}
		},
		interceptKeypress: function(e) {
			if(this.readyForInput) {
				if(e.character == 's') {
					this.printLine("GET CRACKING.");
					this.startCracking();
				}
				this.readyForInput = false;
			}
			if(this.readyForInput === true || this.readyForInput === false) {
				if(e.character == 'x' || e.keyCode == 27) {
					this.printLine("QUIT.");
					this.dead = true;
					this.exit();
				}
			}
		},
		startCracking: function(e) {
			
			var self = this;
			
			var progress = 0;
			var duration = 2000;
			var startTime = new Date().getTime();
			if(this.file.encryptionKey) {
				duration = Math.pow(2, Math.min(this.file.encryptionKey.length, 10)) * 1000;
				console.log("Duration for "+this.file.encryptionKey+" is "+duration+" ms");
			}
			this.session.sendCommand("carriageReturn");
			var timer = setInterval(function() {
				if(self.dead) {
					clearInterval(timer);
					return;
				}
				var progress = (new Date().getTime() - startTime) / duration;
				self.session.sendCommand("addTextAtCursor", {
					text: "Cracking... "+Number(progress*100).toFixed(2)+"%"
				});
				if(progress >= 1) {
					self.file.encrypted = false;
					self.printLine("%INVERTED%CRACK SUCCESSFUL! File has been decrypted.");
					self.printLine("");
					self.printLine("Key was: "+self.file.encryptionKey);
					self.exit();
					clearInterval(timer);
				}
			}, 500);
			
		}
	});

}