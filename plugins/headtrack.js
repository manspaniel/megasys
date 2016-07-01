var async = require('async');
//var hmd = require('node-hmd');
var fs = require('fs');

module.exports = function(server) {

	return;

	server.defineProgram("headtrack", {
		help: [
			"Oculus rift head tracking"
		],
		init: function() {
			var self = this;

			this.printLine("Time for some head tracking.")

			self.hmd = hmd.createManager("oculusrift");

			self.state = 0;

			self.fps = 18;

			self.hmd.getDeviceInfo(function(err, deviceInfo) {
				if(err) {
					self.printLine("Error getting device info: "+err.message);
					return;
				}

				self.printLine("Press %GREEN%s%NORM% to begin capturing, or %GREEN%q%NORM% to quit.");
			});

		},
		_interceptKeypress: function(e) {

			var self = this;

			// If prompting, pass keypresses to default handler
			if(this._onLineInput) {
				this.interceptKeypress(e);
				return;
			}

			// Quit on Q
			if(e.character == 'q') return self.exit();

			// Start recording on S
			if(e.character == "s") {
				this.startRecording();

			// Save on W
			} else if(e.character == "w") {
				this.prompt("Enter name of recording (output):", function(val) {
					if(!val) val = "output";
					fs.writeFile("./client/anim/"+val+".json", JSON.stringify(self.frames), function(err) {
						if(err) {
							self.printLine("Error writing file: "+err.message);
							console.log("Error writing head tracking file", err);
							console.log("Output is",JSON.stringify(self.frames));
						} else {
							self.printLine("Successfully wrote file.");
						}
					})
				});

			// Stop recording on any other button press
			} else {
				this.stopRecording();
			}

		},
		beforeExit: function() {
			clearInterval(this.timer);
		},
		startRecording: function() {

			var self = this;
			self.session.sendCommand("clear");
			self.printLine("Recording started... press %GREEN%s%NORM% to restart, %GREEN%q%NORM% to quit, or any other key to end recording.");

			// Clear previous timer, if any
			clearInterval(this.timer);

			// Start recording
			this.frames = [];
			this.start = new Date().getTime();
			this.timer = setInterval(function() {

				var frame = {
					time: new Date().getTime() - self.start,
					position: self.hmd.getDevicePositionSync(),
					rotation: self.hmd.getDeviceOrientationSync()
				};

				self.frames.push(frame);

			}, 1000/self.fps);
		},
		stopRecording: function() {
			clearInterval(this.timer);
			this.printLine("Recorded ended with "+this.frames.length+" frames.");
			this.printLine("Press %GREEN%s%NORM% to restart, %GREEN%r%NORM% to replay, %GREEN%w%NORM% to write to file or %GREEN%q%NORM% to quit");
		}
	});

}
