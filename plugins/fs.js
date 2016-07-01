var async = require('async');
var path = require('path');

module.exports = function(server) {
	
	server.defineProgram("mkdir", {
		help: [
			"Create a directory with the given name.",
			"Usage: mkdir <name>"
		],
		init: function() {
			var self = this;
			
			if(this.args._.length !== 1) {
				this.showHelp(true);
				self.exit();
				return;
			}
			
			var newPath = this.resolvePath(this.args._[0]);
			var newName = path.basename(newPath);
			var parentPath = path.dirname(newPath);
			
			var parentDirectory = this.computer.getNode(parentPath, this.sessionState);
			var existing = this.computer.getNode(newPath, this.sessionState);
			
			if(existing) {
				self.session.printLine("A "+(existing.isFolder ? 'folder' : 'file')+" with that name already exists in the target directory.");
			} else if(!parentDirectory) {
				self.session.printLine("'"+parentPath+"' does not exists.");
			} else if(!parentDirectory.isFolder) {
				self.session.printLine("'"+parentPath+"' is not a directory.");
			// } else if(!newName.match(/^[A-Z0-9\_\-\.\ ]+$/i)) {
			// 	self.session.printLine("The directory name you have specified contains invalid character.");
			} else {
				self.computer.addNode(parentDirectory, {
					name: newName,
					isFolder: true
				}, this.sessionState);
			}
			
			self.exit();
		}
	});
	
	server.defineProgram("rm", {
		help: [
			"Remove a file or directory.",
			"Usage: rmdir <name>, rm <name>"
		],
		init: function() {
			var self = this;
			
			if(this.args._.length !== 1) {
				this.showHelp(true);
				self.exit();
				return;
			}
			
			var newPath = this.resolvePath(this.args._[0]);
			var newName = path.basename(newPath);
			var parentPath = path.dirname(newPath);
			
			var parentDirectory = this.computer.getNode(parentPath, this.sessionState);
			var existing = this.computer.getNode(newPath, this.sessionState);
			
			if(!existing) {
				self.session.printLine("No such file or directory.");
			} else {
				self.computer.removeNode(parentDirectory, existing, this.sessionState);
			}
			
			self.exit();
		}
	});
	
	server.defineProgram("mv", {
		help: [
			"Move or rename a file or directory.",
			"Usage: mv <source> <dest>"
		],
		init: function() {
			var self = this;
			
			if(this.args._.length !== 1) {
				this.showHelp(true);
				self.exit();
				return;
			}
			
			// Source
			var sourcePath = this.resolvePath(this.args._[0]);
			var sourceName = path.basename(sourcePath);
			var sourceParentPath = path.dirname(sourcePath);
			
			var source = this.computer.getNode(destPath, this.sessionState);
			var sourceParent = this.computer.getNode(destParentPath, this.sessionState);
			
			// Destination unnkknoowwwnnnn
			var destPath = this.resolvePath(this.args._[1]);
			var destName = path.basename(destPath);
			var destParentPath = path.dirname(destPath);
			
			var dest = this.computer.getNode(sourcePath, this.sessionState);
			var destParent = this.computer.getNode(destParentPath, this.sessionState);
			
			if(!source) {
				// Source doesn't exist
				self.session.printLine("The specified source does not exist.");
			} else if(dest && dest.isFolder) {
				// Moving file/folder to the destination folder
				var success = self.computer.addNode(dest, source, this.sessionState);
			} else if(dest) {
				// Moving a file/folder to the destination parent, and changing the name
				var success = self.computer.addNode(dest, source, this.sessionState);
			} else {
				
			}
			
			self.exit();
		}
	});
	
};
