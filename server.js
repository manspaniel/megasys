var async = require('async');
var express = require('express');
var less = require('less');
var serveStatic = require('serve-static');
var path = require('path');
var fs = require('fs');
var extend = require('extend');

var Program = require('./program');
var TerminalComputer = require('./computer');
var TerminalSession = require('./session');

var TerminalNetwork = function(server) {
	
	var self = this;
	
	// Store computers by unique identifier
	var computers = {};
	
	// Index by hostname/ip, by network name
	var networks = {};
	
	var loadFileStructure = function(directory, basePath, parentNode, callback) {
		var fileList = [];
		
		directory = path.resolve(directory);
		basePath = path.resolve(basePath);
		
		async.series([
			function(next) {
				// Get all files/foldes in this directory
				fs.readdir(directory, function(err, files) {
					
					if(err) return callback(err, null);
					
					// Loop over
					async.each(files, function(fileName, next) {
						var filePath = path.join(directory, fileName);
						
						// File def
						var file = {
							name: fileName,
							realPath: filePath,
							path: filePath.substr(basePath.length).replace(/^(\/[^\/]+){2}\/?/, '/')
						};
						
						fileList.push(file);
						
						// Stat the file, and run filters
						async.series([
							// Stat the file
							function(next) {
						
								fs.stat(filePath, function(err, stat) {
									
									if(err) return callback(err, null);
									
									file.isFolder = stat.isDirectory();
									if(file.isFolder) {
										// Folder
										loadFileStructure(filePath, basePath, file, function(err, children) {
											file.children = children;
											next();
										});
									} else {
										// File
										file.size = stat.size;
										file.mtime = stat.mtime;
										next();
									}
									
								});
							
							},
							// Perform filters
							function(next) {
								server.runHook("filter_file_entry", {file: file, parent: parentNode}, function() {
									next();
								});
							}
						], next);
						
					}, next);
				});

			},
			// Run filters on the whole list
			function(next) {
				// Run a filter on the final file list
				server.runHook("filter_file_list", {files: fileList, parent: parentNode}, function() {
					next();
				});
				
			},
			// Finalize the file list
			function(next) {
				
				// Remove items with a 'remove' flag
				fileList = fileList.filter(function(item) {
					return item.remove !== true;
				});
								
				// Sort the results by name
				fileList.sort(function(a, b) {
					return a.name > b.name ? 1 : -1;
				});
				
				next();
				
			}
		], function(err) {
			callback(err, fileList);
		});
	};
	
	self.loadComputersFromDisk = function() {
		
		loadFileStructure("./data", "./data", null, function(err, groups) {
			
			if(err) throw err;
			groups.forEach(function(group) {
				if(group.isFolder) {
					group.children.forEach(function(computerDef) {
						var computer = new TerminalComputer(server);
						computer.groupName = group.name;
						computer.init(computerDef);
						self.indexComputer(computer);
					});
				}
			});
			
		});

	};
	
	self.indexComputer = function(computer) {
		var computerID = computer.computerID = computer.groupName+"/"+computer.name;
		console.log("Indexing computer "+computerID);
		
		computers[computerID] = computer;
		
		if(computer.network) {
			for(var networkName in computer.network) {
				var network = networks[networkName] = networks[networkName] || {};
				var hostnames = computer.network[networkName];
				if(typeof hostnames == 'string') {
					network[hostnames] = computerID;
				} else if(Array.isArray(hostnames)) {
					for(var k in hostnames) {
						network[hostnames[k]] = computerID;
					}
				}
			}
		}
		
		console.log(networks);
	};
	
	self.getComputer = function(networkName, computerName, callback) {
		var network = networks[networkName];
		if(!network) return callback(null);
		if(computerName in network) {
			return callback(computers[network[computerName]]);
		}
		return null;
	};
	
	self.getComputerByID = function(id, callback) {
		if(computers[id]) {
			callback(computers[id]);
		} else {
			server.runHook("get_computer", {id:id}, function(result) {
				if(result) {
					self.indexComputer(result);
					callback(result);
				} else {
					callback(null);
				}
			});
		}
	};
	
	self.saveComputers = function() {
		var keys = Object.keys(computers);
		async.each(keys, function(key, next) {
			var computer = computers[key];
			if(computer.persistant) {
				server.api.saveComputerData(key, computer.serialize(), next);
			}
		});
	};
	
	self.loadComputersFromDisk();
	
};

var TerminalServer = function() {
	var self = this;
	
	self.network = new TerminalNetwork(self);
	
	// Set up HTTP server
	self.express = require('express')();
	self.server = require('http').Server(self.express);
	
	// API
	var API = require('./api');
	self.api = new API();
	
	console.log("API is", self.api);
	
	// Websockets
	self.sockets = require('socket.io')(self.server);
	
	self.sockets.on("connect", function(socket) {
		
		if(!socket.termSession) {
			socket.termSession = new TerminalSession(self, socket);
		}
		
		socket.termSession.start();
		
	});
	
	// Serve static files
	self.express.use(serveStatic('client', {
		'index': ['index.html']
	}));
	
	// LESS dynamic compilation
	self.express.get(/\.css$/, function(req, res, next) {
		
		// Was a .css file requested?
		var filename = path.resolve(__dirname + '/client' + req.url.replace(/\.css$/, '.less'));
		
		// Ensure file is in correct direction
		if(filename.indexOf(__dirname) !== 0) {
			console.log("B");
			return next();
		}
		
		// Check if the file exists
		fs.exists(filename, function(exists) {
			console.log("D",filename);
			if(!exists) {
				return next();
			}
			
			// Compile the file!
			fs.readFile(filename, function(err, buf) {
				if(err) {
					console.log(">>>> Error reading LESS file "+filename, err);
					throw err;
				}
				
				var parser = new less.Parser({
					paths: [path.dirname(filename)],
					filename: path.basename(filename)
				});
				
				parser.parse(buf.toString(), function(err, tree) {
					if(err) {
						res.writeHead(500);
						res.end("A LESS compilation error occurred while rendering this file:\n"+JSON.stringify(err));
						console.log("LESS Compilation Error");
						console.log(err);
					} else {
						try {
							var output = tree.toCSS();
							res.writeHead(200, {
								'Content-type': 'text/css'
							});
							res.end(output);
						} catch(e) {
							console.log(">>>> Error compiling LESS file "+filename, e);
							res.writeHead(500, {
								'Content-type': 'text/css'
							});
							res.end(e.toString());
						}
					}
				});
			});
		});
		
	});
	
	self.hooks = {};
	
	self.addHook = function(name, priority, func) {
		if(arguments.length == 2) {
			func = priority;
			priority = 0;
		}
		self.hooks[name] = self.hooks[name] || [];
		self.hooks[name].push({
			priority: priority || 50,
			callback: func
		});
		self.hooks[name].sort(function(a, b) {
			return priority.b - priority.a;
		});
	};
	
	self.runHook = function(name, args, callback) {
		var hooks = self.hooks[name];
		if(hooks && hooks.length) {
			async.eachSeries(hooks, function(item, next) {
				item.callback(args, next, callback);
			}, callback);
		} else {
			callback();
		}
	};
	
	// Allow .program files
	self.addHook("filter_file_entry", function(args, next) {
		var file = args.file;
		if(file.name.match(/\.program$/)) {
			file.name = file.name.replace(/\.program$/, '');
			file.path = file.path.replace(/\.program$/, '');
			file.programName = file.name;
			file.isProgram = true;
		}
		next();
	});
	
	// Allow computer.json files
	self.addHook("filter_file_entry", function(args, next) {
		var file = args.file;
		if(file.name == "computer.json") {
			var computer = args.computer;
			file.remove = true;
			fs.readFile(file.realPath, function(err, contents) {
				extend(args.parent, JSON.parse(contents));
				next();
			});
		} else {
			next();
		}
	});
	
	// Use .json files as file meta
	self.addHook("filter_file_list", function(args, next, callback) {
		var files = args.files;
		var fileMeta = {};
		async.each(files, function(file, next) {
			// Look for JSON files
			if(file.name.match(/\.json$/)) {
				
				// Mark the meta file for removal from the file list
				file.remove = true;
				
				// Read the file, parse it's contents
				fs.readFile(file.realPath, function(err, buf) {
					if(err) throw err;
					fileMeta[file.name.replace(/\.json$/, '')] = JSON.parse(buf);
					
					next();
				});
				
			} else {
				next();
			}
		}, function() {
			
			// Using the results in fileMeta, apply the meta values to the actual files
			for(var k in files) {
				var file = files[k];
				if(file.name in fileMeta) {
					var meta = fileMeta[file.name];
					for(var key in meta) {
						file[key] = meta[key];
					}
				}
			}
			
			next();
			
		});
	});
	
	self.programs = {};
	
	self.defineProgram = function(name, extendsProgram, def) {
		if(arguments.length == 2 && typeof arguments[1] == 'object') {
			def = extendsProgram;
			extendsProgram = null;
		}
		var program = {
			name: name[k],
			extendsProgram: extendsProgram,
			extension: def
		};
		names = name.split(/\s+/g);
		for(var k in names) {
			self.programs[names[k]] = program;
		}
	};
	
	self.sequenceTypes = {};
	
	self.defineSequenceType = function(name, def) {
		self.sequenceTypes[name] = def;
	};
	
	var extendProgram = function(program, extendWith) {
		var programDef = self.programs[extendWith];
		if(!programDef) {
			console.log("No program named "+extendWith);
			program.invalid = true;
			return;
		}
		if(programDef.extendProgram) {
			extendProgram(program, programDef.extendProgram);
		}
		for(var k in programDef.extension) {
			program[k] = programDef.extension[k];
		}
	};
	
	self.getProgramInstance = function(name) {
		var program = new Program();
		program.name = name;
		extendProgram(program, name);
		return program;
	};
	
	// Save and load computers to DB
	setInterval(function() {
		self.network.saveComputers();
	}, 10000);
	
	self.addHook("get_computer", 1, function(args, next, complete) {
		
		console.log("Fetching computer "+args.id);
		self.api.fetchComputerData(args.id, function(err, result) {
			console.log("Result is ", result);
			if(result) {
				var computer = new TerminalComputer(self);
				computer.init(result.data);
				self.network.indexComputer(computer);
				complete(computer);
			} else {
				next();
			}
		});
		
	});
	
	var colors = ['NORM','RED','GREEN','BLUE','YELLOW','MAGENTA','CYAN','WHITE'];
	var styleDict = {
		INVERTED: 8
	};
	for(var k in colors) {
		styleDict[colors[k]] = k*1;
	}
	
	self.parseTextStyle = function(text, lineSplitter) {
		
		if(Array.isArray(text)) {
			text = text.join('\n');
		}
		
		var substrings = text.split(/\%[A-Z\|]+\%/);
		var styleTokens = text.match(/\%([A-Z\|]+)\%/g);
		var cleanString = substrings.join('');
		
		var output = {
			text: cleanString,
			styles: new Array(cleanString.length)
		};
		
		var style = 0, index = 0;
		for(var k in substrings) {
			var length = substrings[k].length;
			
			// Add style values for each letter
			for(var m = 0; m < length; m++) {
				output.styles[index] = style;
				index++;
			}
			
			// Update style for next chunk
			if(styleTokens) {
				var styleDef = styleTokens[k];
				if(styleDef) {
					styleDef = styleDef.substr(1, styleDef.length-2).split(/\|/g);
					style = 0;
					for(var s in styleDef) {
						var styleName = styleDef[s];
						if(styleName in styleDict) {
							style = style | styleDict[styleName];
						}
					}
				}
			}
		}
		
		var items = [];
		var textLines = output.text.match(lineSplitter || /(\n|[^\n]+)/g);
		var lastPos = 0;
		var lastWasNewline = false;
		for(k in textLines) {
			var segment = textLines[k];
			if(segment == "\n") {
				// Another new line
				if(lastWasNewline) {
					items.push({
						text: "",
						length: 0,
						styles: [],
						wraps: false
					});
					lastWasNewline = false;
				} else {
					lastWasNewline = true;
				}
			} else {
				// Not a new line
				items.push({
					text: segment,
					length: segment.length,
					styles: output.styles.slice(lastPos, lastPos + segment.length),
					wraps: textLines[k*1+1] == "\n" ? false : true
				});
				lastWasNewline = false;
			}
			lastPos += segment.length;
		}
		
		return items;
		
	};
	
	var loadPlugins = function(callback) {
		
		fs.readdir("./plugins/", function(err, files) {
			
			if(err) throw err;
			
			for(var k in files) {
				if(!files[k].match(/\.js$/)) continue;
				var plugin = require("./plugins/"+files[k]);
				if(typeof plugin == 'function') {
					plugin(self);
				} else {
					console.log("Plugin "+files[k]+" did not export a function.");
				}
			}
			
			callback();
		});
		
	};
	
	// Load plugins then start listening
	loadPlugins(function() {
		self.server.listen(1337);
	});

};

new TerminalServer();