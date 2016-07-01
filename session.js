var path = require('path');
var fs = require('fs');
var async = require('async');
var extend = require('extend');
//var hmd = require('node-hmd');

var TerminalComputer = require('./computer');

var TerminalSession = function(server, socket) {

	var self = this;

	this.socket = self;

	this.programStack = [];
	this.currentProgram = null;

	socket.on('keypress', function(e) {
		if(self.currentProgram) {
			self.currentProgram._interceptKeypress(e);
		}
	});

	self.hmd = null;
	self.hmdTimer = null;

	socket.on('oculusMode', function(state) {

		console.log("Oculus mode", state);

		if(!self.hmd) {
			self.hmd = hmd.createManager("oculusrift");
		}

		self.hmd.getDeviceInfo(function(err, deviceInfo) {
			if(err) {
				self.printLine("Error getting device info: "+err.message);
				return;
			}
			clearInterval(self.hmdTimer);
			if(state) {
				self.hmdTimer = setInterval(function() {

					var frame = {
						position: self.hmd.getDevicePositionSync(),
						rotation: self.hmd.getDeviceOrientationSync()
					};

					self.sendCommand("updateCamera", frame);

				}, 50);
			}
		});

	});

	this.start = function() {

		async.series([
			// Handshake
			function(next) {
				// Handshake with the client, grabbing sessionID if it exists
				socket.once("greet", function(data) {
					self.sessionID = data.sessionID;
					next();
				});
				self.sendCommand("greet");
			},
			// Session validation
			function(next) {
				// If there's a sessionID, validate it
				if(self.sessionID) {
					console.log("Validating session");
					server.api.validateSessionID(self.sessionID, function(user, requiresPassword) {
						if(requiresPassword) {
							console.log("Requires password");
							// Session is valid, but old enough to require login details
							self.showLogin(user.username);
							self.sessionID = null;
						} else if(user) {
							console.log("Valid user");
							// Session is valid and recent, so just log them back in and show them their computer
							self.setUser(user);
							self.launchOwnComputer();
						} else {
							console.log("Expired/invalid");
							// Session has expired or is invalid
							self.sessionID = null;
							self.showLogin();
						}
						next();
					});
				} else {
					console.log("All good");
					self.showLogin();
					next();
				}
			},
			// Session assurances
			function(next) {
				// If the sessionID is not set (or has been unset) then generate a new session key for them
				if(!self.user) {
					console.log("Creating session");
					server.api.createSession({}, function(sessionID) {
						self.sessionID = sessionID;
						self.sendCommand('setSession', {sessionHash: self.sessionID});
						next();
					});
				} else {
					next();
				}
			}
		]);

	};

	this.showLogin = function() {
		server.network.getComputerByID('instance/login', function(computer) {
			self.pushProgram(self.getProgramInstance("login", {}, computer));
		});

	};

	this.getProgramInstance = function(name, args, computer, parentProgram) {
		var program = server.getProgramInstance(name);
		program.args = args;
		program.computer = computer;
		program.session = self;
		program.server = server;
		program.parent = parentProgram;
		program.sessionState = parentProgram ? extend({}, parentProgram.sessionState) : {
			directory: '~',
			home: '/home/guest/',
			user: 'guest',
			$path: ["/bin/"]
		};
		return program;
	};

	this.popProgram = function() {
		self.currentProgram = self.programStack.pop();
		if(self.currentProgram) {
			self.currentProgram.resume();
		}
	};

	this.pushProgram = function(prog) {
		if(self.currentProgram) {
			self.programStack.push(self.currentProgram);
		}
		self.currentProgram = prog;
		prog.init();
	};

	this.killAllPrograms = function() {
		var stack = self.programStack;
		self.programStack = [];
		stack.forEach(function(program) {
			program.exit();
			program.dead = true;
		});
	};

	this.programEnded = function(program) {
		// Remove the program, and any child programs, from the program stack
		var programIndex = self.programStack.indexOf(program);
		if(programIndex > -1) {
			self.programStack.splice(programIndex);
		}
		self.currentProgram = self.programStack.pop();
		if(self.currentProgram) {
			self.currentProgram.resume();
		}
	};

	this.setUser = function(user) {
		self.user = user;
		console.log("About to set user", user, self.sessionID);
		if(self.sessionID && user) {
			server.api.setSessionUser(self.sessionID, user);
		}
	};

	this.launchOwnComputer = function() {
		self.killAllPrograms();
		server.network.getComputerByID('user/'+self.user.username, function(computer) {
			console.log("Received computer", computer);
			self.pushProgram(self.getProgramInstance("shell", {}, computer));
		});
	};

	this.sendCommand = function(name, args) {
		socket.emit('cmd', {name:name, args:args});
	};

	this.printLine = function(text) {
		text = server.parseTextStyle(text || "");
		self.sendCommand("printLine", {
			text: text
		});
	};

};

module.exports = TerminalSession;
