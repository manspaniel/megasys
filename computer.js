var path = require('path');
var extend = require('extend');
var fs = require('fs');

var Computer = function(server) {
	
	var self = this;
	
	this.init = function(def) {
		extend(self, def);
	};
	
	this.addNode = function(parent, def, sessionState) {
		def.path = path.join(parent.path, def.name);
		def.mtime = def.mtime || new Date();
		def.children = def.children || [];
		parent.children.push(def);
		parent.children.sort(function(a, b) {
			return a.name > b.name ? 1 : -1;
		});
	};
	
	this.removeNode = function(parent, node, sessionState) {
		var index = parent.children.indexOf(node);
		if(index >= 0) {
			parent.children.splice(index, 1);
		}
	};
	
	this.getFileContents = function(file, sessionState, callback) {
		
		console.log("Getting file contents", file);
		
		// If no file
		if(!file) {
			callback("File not found");
			return;
		}
		
		// If file is encrypted
		if(file.encrypted) {
			callback("File '"+file.name+"' is encrypted");
			return;
		}
		
		// If we already have the contents of the file
		if(file.contents !== undefined) {
			callback(null, file.contents);
			return;
		}
		
		// If file has a realPath, read the file
		if(file.realPath) {
			fs.readFile(file.realPath, function(err, buf) {
				if(err) {
					callback("File has been corrupted.");
				} else if(buf.length > 1024 * 10) {
					callback("File is too big to open.");
				} else {
					callback(null, buf.toString());
				}
			});
			return;
		}
		
		callback("Unable to read file");
		
	};
	
	this.getNode = function(filePath, sessionState) {
		filePath = self.resolvePath(filePath, sessionState).replace(/\/$/, '');
		
		console.log("Resolve path is",filePath);
		
		var pathComponents = filePath.replace(/(^\/|\/$)/g, '').split('/');
		
		if(filePath === "") {
			return this;
		}
		
		var parent = this;
		while(true) {
			var foundChild = false;
			for(var k in parent.children) {
				console.log("Comparing", parent.children[k].name, pathComponents[0]);
				if(parent.children[k].name == pathComponents[0]) {
					console.log("Mached ", pathComponents[0]);
					parent = parent.children[k];
					pathComponents.shift();
					console.log("Path is now", pathComponents);
					if(pathComponents.length === 0) {
						console.log("Returning");
						return parent;
					}
					foundChild = true;
					break;
				}
			}
			if(!foundChild) break;
		}
		
		return null;
	};
	
	this.resolvePath = function(dir, sessionState) {
		
		sessionState = sessionState || {directory:"/",home:"/"};
		var base = sessionState.directory;
		
		// If the current directory starts with ~
		if(base[0] == "~") {
			base = path.join("/home/"+sessionState.user, base.replace(/^~\/*/, ''));
		}
		
		// If the target directory starts with ~
		if(dir[0] == "~") {
			dir = path.join("/home/"+sessionState.user, dir.replace(/^~\/*/, ''));
		}
		
		// And finally resolve the directory...
		dir = path.resolve(base, dir);
		
		return dir;
	};
	
	this.getFSNode = function(filePath) {
		filePath = filePath.replace(/\/$/);
	};
	
	this.clone = function() {
		
		var clone = new Computer();
		
		extend(true, clone, self);
		
		return clone;
		
	};
	
	this.serialize = function() {
		return this;
	};
	
};

module.exports = Computer;