var async = require('async');

module.exports = function(server) {
	
	server.defineProgram("help", {
		help: [
			"Provides usage information on some p.",
			"Usage: help or help <name>"
		],
		init: function() {
			
			console.log("Path is ", this.sessionState.$path);
			

			var helpItems = [];
			var helpProgramIndex = {};
			
			for(var k in this.sessionState.$path) {
				
				var pathElement = this.sessionState.$path[k];
				var node = this.computer.getNode(pathElement, this.sessionState);
				
				for(var m in node.children) {
					
					var progNode = node.children[m];
					
					if(progNode.name in helpProgramIndex) continue;
					
					helpItems.push(progNode.name);
					helpProgramIndex[progNode.name] = true;
					
				}
				
			}
				
			helpItems.sort();
			
			if(this.args._[0]) {
				// Requested help for a particular program
				var programName = this.args._[0];
				if(programName in helpProgramIndex) {
					var program = this.server.getProgramInstance(programName);
					for(var k in program.help) {
						this.session.printLine(program.help[k]);
					}
				} else {
					this.session.printLine("No help information available. Check program exists.");
				}
				
			} else {
				
				// List all programs
				this.session.printLine("Listing all programs found. Type 'help <name>' for help with a program.");
				
				for(var k in helpItems) {
					var program = this.server.getProgramInstance(helpItems[k]);
					this.session.printLine("%RED%"+helpItems[k]+"%NORM% "+(program.help ? program.help[0] : "No description available"));
				}
			}
			
			this.exit();
			
		}
	});

}