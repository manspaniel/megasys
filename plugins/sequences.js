module.exports = function(server) {
	
	server.defineSequenceType("clearScreen", {
		init: function(callback) {
			this.session.sendCommand("clear", {
				text: this.text
			});
			
			this.done();
		}
	});
	
	server.defineSequenceType("delay", {
		init: function(callback) {
			var self = this;
			setTimeout(function() {
				self.done();
			}, this.duration);
		}
	});
	
	server.defineSequenceType("text", {
		init: function(callback) {
			this.session.sendCommand("printLine", {
				text: server.parseTextStyle(this.text)
			});
			
			this.done();
		}
	});
	
	server.defineSequenceType("promptKey", {
		init: function(callback) {
			
			var self = this;
			
			// Save the callback
			self._callback = callback;
			
			self.promptForKey(this.text);
			
		},
		promptForKey: function(msg) {
			
			var self = this;
			
			self.program.promptKey(msg, function(e) {
				self.validate(e, function(err) {
					
					if(err || err === false) {
						self.promptForKey(err || msg);
					} else {
						self.process(e, function() {
							self.done();
						});
					}
					
				});
				
			});
			
		},
		validate: function(e, callback) {
			
			callback();
			
		}
	});
	
	server.defineSequenceType("prompt", {
		init: function(callback) {
			
			var self = this;
			
			// Save the callback
			self._callback = callback;
			
			self.showPrompt(this.text);
			
		},
		showPrompt: function(msg) {
			
			var self = this;
			
			self.program.prompt(msg, this.defaultValue, function(value) {
				
				self.validate(value, function(err, _modifiedValue) {
					
					if(_modifiedValue !== undefined) value = _modifiedValue;
					
					if(err || err === false) {
						self.showPrompt(err || msg);
					} else {
						self.process(value, function() {
							self.done();
						});
					}
					
				});
				
			});
			
		},
		validate: function(value, callback) {
			
			if(this.promptType == "yesno") {
				
				if(value.match(/(y|yes)/i)) {
					callback(null, true);
				} else if(value.match(/(n|no)/i)) {
					callback(null, false);
				} else {
					callback("Please enter 'yes' or 'no'");
				}
				
			} else {
				
				callback();
				
			}
			
		}
	});
	
};