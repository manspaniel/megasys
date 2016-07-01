define(["lib/async"], function(async) {
	
	var TerminalRenderer = function() {
		var self = this;
		
		self.terminal = null;
		
		self.mainCanvas = null;
		self.mainContext = null;
		
		self.textCanvas = null;
		self.textContext = null;
		
		self.config = {
			cellWidth: 16,
			cellHeight: 32,
			font: "24px \"Anonymous Pro\"",
			padding: [20, 40, 40, 40],
			bgColor: '#000000',
			cursorColor: '#00ff00',
			cursorOffsetX: -2,
			cursorOffsetY: 8,
			textColors: {
				NORM:		"#9cffab",
				RED:		"#ff0000",
				GREEN:		"#00ff00",
				BLUE:		"#0000ff",
				YELLOW:		"#ffff00",
				MAGENTA:	"#ff00ff",
				CYAN: 		"#00ffff",
				WHITE: 		"#ffffff"
			}
		}
		
		self.colorDict = {}
		var colors = ['NORM', 'RED', 'GREEN', 'BLUE', 'YELLOW', 'MAGENTA', 'CYAN', 'WHITE'];
		for(var k in colors) {
			self.colorDict[k] = self.config.textColors[colors[k]];
		}
		
		self.renderText = function() {
			
			var ctx = self.textContext;
			
			ctx.font = self.config.font;
			
			ctx.clearRect(0, 0, self.textCanvas.width, self.textCanvas.height);
			
			var offsetX = self.config.padding[3];
			var offsetY = self.config.padding[0];
			
			var cellWidth = self.config.cellWidth;
			var cellHeight = self.config.cellHeight;
			
			var index = 0;
			for(var y = 0; y < self.terminal.rows; y++) {
				for(var x = 0; x < self.terminal.cols; x++) {
					var chr = self.terminal.matrix[index];
					var style = self.terminal.matrix[index+1];
					index += 2;
					
					// Set the color
					var colorCode = style & 7;
					var textColor = self.colorDict[colorCode];
					ctx.fillStyle = textColor;
					
					// Draw filled?
					var isCursor = (self.terminal.cursorIsVisible && self.terminal.cursorIsEnabled && self.terminal.cursorPos[0] == x && self.terminal.cursorPos[1] == y);
					if(isCursor && self.terminal.cursorStyle) {
						// Cursor is a bar (either to the left or right of the character)
						ctx.fillStyle = self.config.cursorColor;
						ctx.fillRect(offsetX + x * cellWidth + self.config.cursorOffsetX + (self.terminal.cursorStyle === 2 ? cellWidth : 0), offsetY + y * cellHeight + self.config.cursorOffsetY, cellWidth * 0.2, cellHeight);
						ctx.fillStyle = textColor;
					} else if(isCursor || (style & 8)) {
						// Cursor is a full block
						if(isCursor) {
							ctx.fillStyle = self.config.cursorColor;
						}
						ctx.fillRect(offsetX + x * cellWidth + self.config.cursorOffsetX, offsetY + y * cellHeight + self.config.cursorOffsetY, cellWidth, cellHeight);
						ctx.fillStyle = self.config.bgColor;
					}
					
					if(chr) {
						ctx.fillText(chr, offsetX + x * cellWidth, offsetY + (y + 1) * cellHeight)
					}
				}
			}
			
		}
		
		self.renderCount = 0;
		
		self.render = function() {
			
			if(self.terminal.needsRender) {
				
				self.renderText();
				
				self.mainContext.fillStyle = self.config.bgColor;
				self.mainContext.fillRect(0, 0, self.mainCanvas.width, self.mainCanvas.height);
				
				self.mainContext.drawImage(self.textCanvas, 0, 0);
				
				self.terminal.needsRender = false;
				self.renderCount++;
				
			}
			
		}
		
		self.setTerminal = function(terminal) {
			self.terminal = terminal;
		}
		
		var renderInterval;
		
		self.startRendering = function() {
			clearInterval(renderInterval);
			renderInterval = setInterval(self.render, 50);
		}
		
		self.pauseRendering = function() {
			clearInterval(renderInterval);
		}
		
		self.init = function() {
			
			self.mainCanvas = document.createElement('canvas');
			self.mainContext = self.mainCanvas.getContext('2d');
			self.textCanvas = document.createElement('canvas');
			self.textContext = self.textCanvas.getContext('2d');
			
			self.mainCanvas.width = self.config.cellWidth * self.terminal.cols + self.config.padding[1] + self.config.padding[3];
			self.mainCanvas.height = self.config.cellHeight * self.terminal.rows + self.config.padding[0] + self.config.padding[2];
			
			self.textCanvas.width = self.mainCanvas.width;
			self.textCanvas.height = self.mainCanvas.height;
			
			self.startRendering();
			
		}
		
	}
	
	return TerminalRenderer;
	
});