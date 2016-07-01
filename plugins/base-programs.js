var async = require('async');
var path = require('path');
var printf = require('printf');

module.exports = function(server) {
	
	server.defineProgram("ls", {
		help: [
			"Lists files and folders in the current working directory"
		],
		init: function() {
			var self = this;
			var folder = this.computer.getNode(this.sessionState.directory, this.sessionState);
			
/*
			self.session.printLine("%CYAN%.");
			self.session.printLine("%CYAN%..");
*/
			for(var k in folder.children) {
				var file = folder.children[k];
				var style = 'NORM';
				if(file.isFolder) style = 'CYAN';
				if(file.isProgram) style = 'GREEN';
				if(file.encrypted) style = 'YELLOW';
				if(file.isProgram) style += '|INVERTED';
				
				var line = [];
				
				// Permissions
				line.push("rw-");
				
				// Encryption
				var encryptionLabel = "";
				if(file.encrypted) {
					encryptionLabel = "ENCRYPTED";
				}
				line.push(printf('%-9s', encryptionLabel));
				
				// Date modified
				if(file.mtime && file.mtime instanceof Date) {
					line.push(printf('%04d\-%02d\-%02d', file.mtime.getFullYear(), file.mtime.getMonth() + 1, file.mtime.getDate()));
				} else {
					line.push("---      ");
				}
				
				// Filesize
				var size = file.size || 0;
				var units = 'B';
				if(size > 1024 * 1024 * 1024) {
					size = size / (1024 * 1024 * 1024);
					units = 'GB';
				} else if(size > 1024 * 1024) {
					size = size / (1024 * 1024);
					units = 'MB';
				} else if(size > 1024) {
					size = size / 1024;
					units = 'KB';
				}
				
				line.push(printf('% 8.2f % -3s', size, units));
				
				line.push(printf('% -20s', file.name.substr(0, 20)));
				
				self.session.printLine(("%"+style+"%") + line.join(' '));
			}
			self.exit();
		}
	});
	
	server.defineProgram("pwd", {
		help: [
			"Prints the current working directory"
		],
		init: function() {
			this.session.sendCommand("addTextAtCursor", {
				text: this.resolvePath(this.sessionState.directory)
			});
			this.session.sendCommand("carriageReturn");
			this.exit();
		}
	});
	
	server.defineProgram("cd", {
		help: [
			"Changes the current working directory.",
			"Usage: cd <dir>"
		],
		init: function() {
			if(this.args._.length !== 1) {
				this.showHelp();
			} else {
				var folder = this.computer.getNode(this.args._[0], this.sessionState);
				if(!folder) {
					this.session.printLine("No such directory.");
				} else if(!folder.isFolder) {
					this.session.printLine("\""+folder.path+"\" is not a directory.");
				} else {
					this.parent.sessionState.directory = folder.path;
				}
			}
			this.exit();
		}
	});
	
};
