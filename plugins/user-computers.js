module.exports = function(server) {
	
	var getFreshComputer = function(callback) {
		server.network.getComputerByID("instance/start", function(computer) {
			var clone = computer.clone();
			clone.groupName = "user";
			callback(clone);
		})
	}
	
	// Fetch user computers from the db
	server.addHook("get_computer", 0, function(args, next, complete) {
		var id = args.id;
		
		console.log("Getting computer", args);
		
		if(id.match(/^user\//)) {
			
			console.log("Getting fresh computer");
			
			var username = id.replace(/^user\//, '');
			getFreshComputer(function(computer) {
				
				computer.name = username;
				computer.persistant = true;
				server.network.indexComputer(computer);
				complete(computer);
				
			});
			
		} else {
			next();
		}
		
	});

}