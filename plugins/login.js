var async = require('async');
var KEYCODES = require('../keycodes');

module.exports = function(server) {
	
	server.defineProgram("login", {
		init: function() {
			
			this.info = {};
			
			var self = this;
			
			self.runSequence([
				{
					type: "clearScreen"	
				},
				{
					type: "text",
					text: [
						"%GREEN%Megasys Pty. Ltd. Terminal v300.%NORM%",
						"Operating system has not yet been initialized."
					]
				},
				{
					type: "delay",
					duration: 2000
				},
				{
					type: "promptKey",
					text: "Press %GREEN%ENTER%NORM% to continue, or %MAGENTA%any other key%NORM% to cancel setup and reboot.",
					process: function(e, callback) {
						if(e.keyCode == KEYCODES.ENTER) {
							callback();
						} else {
							self.exit();
							self.session.pushProgram(self.session.getProgramInstance("login", {}, self.computer));
						}
					}
				},
				{
					type: "text",
					text: "Please wait..."
				},
				{
					type: "delay",
					duration: 200
				},
				{
					type: "clearScreen"	
				},
				{
					type: "text",
					text: [
						"Welcome to %GREEN%Megasys Pty. Ltd.%NORM% Terminal v300.",
						"Let's take a moment to set up your new computer.",
						""
					]
				},
				{
					type: "promptKey",
					text: "Press %GREEN%L%NORM% to log in, %GREEN%C%NORM% to create an account, or %GREEN%ESCAPE%NORM% to reboot.",
					validate: function(e, callback) {
						if(e.character == 'l' || e.character == 'c' || e.keyCode == KEYCODES.ESCAPE) {
							console.log("All good");
							callback();
						} else {
							callback(false);
						}
					},
					process: function(e, callback) {
						
						console.log("Received", e);
						if(e.character == 'c') {
							self.beginAccountCreation();
						} else {
							self.beginLogin();
						}
						
					}
				}
			]);
		},
		beginAccountCreation: function() {
			
			var self = this;
			
			var info = {};
			
			// New user
			self.runSequence([
				{
					type: "prompt",
					text: "Enter your desired username",
					validate: function(val, callback) {
						server.api.isUsernameValid(val, function(err) {
							callback(err);
						});
					},
					process: function(val, next) {
						info.username = val;
						next();
					}
				},
				{
					type: "prompt",
					text: "Choose a password (min 5 chars)",
					promptType: "secure",
					validate: function(val, callback) {
						if(val.length < 5) {
							callback("Password is too short");
						} else {
							callback();
						}
					},
					process: function(val, next) {
						info.password = val;
						next();
					}
				},
				{
					type: "prompt",
					text: "Enter your full name (optional)",
					validate: function(val, callback) {
						callback();
					},
					process: function(val, next) {
						console.log("Got full name");
						info.fullName = val;
						next();
					}
				},
				{
					type: "prompt",
					text: "Is this information correct?",
					promptType: "yesno",
					defaultValue: "yes",
					process: function(val, next) {
						
						if(val) {
							// Create user
							next();
						} else {
							next();
							setTimeout(function() {
								self.beginAccountCreation();
							}, 1)
						}
						
					}
				},
				{
					type: "delay",
					duration: 2000
				},
				{
					text: "Your account has been created successfully. Welcome to %GREEN%Megasys%NORM%!\nLaunching shell."
				}
			], function() {
				server.api.createAccount(info, function(err, user) {
					if(err) {
						self.printLine(err);
						self.beginAccountCreation();
					} else {
						self.session.setUser(user);
						self.session.launchOwnComputer();
					}
				});
			});
			
		},
		beginLogin: function() {
			var self = this;
			
			var info = {};
			
			// New user
			self.runSequence([
				{
					text: "Please log in using your %GREEN%Megasys%NORM% username and password:"
				},
				{
					type: "prompt",
					text: "Username",
					process: function(val, next) {
						info.username = val;
						next();
					}
				},
				{
					type: "prompt",
					text: "Password",
					promptType: "secure",
					process: function(val, next) {
						info.password = val;
						next();
					}
				},
				{
					type: "delay",
					duration: 1337
				}
			], function() {
				server.api.verifyCredentials(info, function(err, user) {
					if(err) {
						self.printLine(err);
						self.beginLogin();
					} else {
						self.session.setUser(user);
						self.session.launchOwnComputer();
					}
				});
			});

		}
	})
	
}