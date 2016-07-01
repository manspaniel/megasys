var minimist = require('minimist');

var first = [ '"Perth', 'Glory', '344.MOV"' ];
var second = [ 'Perth\\', 'Glory\\', '344.MOV' ];
var parseCommandOptions = function(optionString) {
	var options = minimist(optionString);
	
	console.log(options);
	
	var str = options._.join(' ');
	var items = [];
	var index = 0;
	var ignoreNext = false;
	var inString = null;
	
	console.log("Using > "+str);
	
	for(var x = 0; x < str.length; x++) {
		
	}
	
	return options;
};

parseCommandOptions("Meow");
parseCommandOptions("\"Face test meow\"");