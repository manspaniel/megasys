define(["lib/jquery", "megasys/terminal-renderer", "megasys/terminal", "megasys/scene"], function($, TerminalRenderer, Terminal, TerminalScene) {
	
	var MegasysGame = function() {
		
		var self = this;
		
		// The canvas renderer
		this.terminalRenderer = window.terminalRenderer = new TerminalRenderer();
		
		// The terminal client
		this.terminal = window.terminal = new Terminal();
		
		// The 3d scene
		this.scene = new TerminalScene();
		
		// Boot up
		this.boot = function() {
			
			// Start up the renderer
			self.terminalRenderer.setTerminal(this.terminal);
			self.terminalRenderer.init();
			
			// Init the terminal
			self.terminal.init();
			
			// And start the scene
			self.scene.setTerminal(self.terminal);
			self.scene.setScreenRenderer(self.terminalRenderer);
			self.scene.init();
			
		}
		
	}
	
	return MegasysGame;
	
});