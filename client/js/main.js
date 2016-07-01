// Configure require.js
require.config({
	baseUrl: "js",
	paths: {
	},
	shim: {
		'lib/three': {
			exports: 'THREE'
		},
		'lib/jquery': {
			exports: 'jQuery'
		}
	},
// 	urlArgs: "bust=" +  (new Date()).getTime()
});

require(["megasys/game"], function(MegasysGame) {
	var game = new MegasysGame();
	game.boot();
});