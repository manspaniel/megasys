define(["lib/three", "lib/async", "lib/jquery"], function(THREE, async, $) {
	
	var lerpVal = function(start, end, ratio, clamp) {
		var val = start + (end - start) * ratio;
		if(clamp) val = Math.min(1, Math.max(0, val));
		return val;
	}
	
	var TerminalScene = function() {
		
		var self = this;
		
		self.scene = null;
		self.terminal = null;
		self.renderer = null;
		self.screenRenderer = null;
		self.oculusEffect = null;
		self.oculusMode = false;
		self.camera = null;
		self.screenPlane = null;
		self.meshObjects = {};
		
		var screenWidth = 0;
		var screenHeight = 0;
		
		self.updateWindowSize = function() {
			
			screenWidth = window.innerWidth;
			screenHeight = window.innerHeight;
			
			self.camera.aspect = screenWidth / screenHeight;
			self.camera.updateProjectionMatrix();
			
			self.renderer.setSize(window.innerWidth, window.innerHeight);
			
			self.oculusEffect.setSize(window.innerWidth, window.innerHeight);

		}
		
		self.animate = function(time) {
			
			requestAnimationFrame(self.animate);
			self.renderFrame(time || 0);

		}
		
		var cameraSetManually = false;
		
		var tick = 1;
		var screenRenderCount = 0;
		
		var animationTime = 0;
		var currentAnimationFrame = 0;
		var animationFrames = null;
		
		var cameraMoveDuration = 0;
		var cameraMoveTime = 0;
		
		var cameraPositionStart = new THREE.Vector3(0, 0, 0);
		var cameraRotationStart = new THREE.Vector3(0, 0, 0);
		var cameraPosition = new THREE.Vector3(0, 0, 0);
		var cameraRotation = new THREE.Vector3(0, 0, 0);
		var cameraPositionEnd = new THREE.Vector3(0, 0, 0);
		var cameraRotationEnd = new THREE.Vector3(0, 0, 0);
		
		var mouseStrengthStart = 0;
		var mouseStrength = 0;
		var mouseStrengthEnd = 1;
		
		var mouseStrengthTime = 0;
		var mouseStrengthDuration = 0;
		
		var targetMouseX = 0, targetMouseY = 0;
		var mouseSpeedX = 0, mouseSpeedY = 0;
		var mouseX = 0, mouseY = 0;
		var mouseRotateFriction = 10;
		
		var lastRenderTime = 0;
		this.renderFrame = function(time) {
			
			time = time || 1;
			if(lastRenderTime == 0) lastRenderTime = time;
			
			var renderDelta = time - lastRenderTime;
			
			lastRenderTime = time;
			
			tick += renderDelta;
			
			if(!cameraSetManually) {
				
				// Get current animation frame
				if(animationFrames && currentAnimationFrame < animationFrames.length - 1) {
					animationTime += renderDelta;
					var lastFrame, nextFrame;
					for(var k = currentAnimationFrame; k < animationFrames.length; k++) {
						var frame = animationFrames[k];
						if(frame.time < animationTime) {
							lastFrame = frame;
							currentAnimationFrame = k;
						} else if(frame.time >= animationTime) {
							nextFrame = frame;
 							break;
						}
					}
					if(lastFrame && nextFrame) {
						// Animate camera pos
						cameraMoveDuration = nextFrame.time - lastFrame.time;
						cameraMoveTime = animationTime - lastFrame.time;
						cameraPositionStart = lastFrame.position;
						cameraPositionEnd = nextFrame.position;
						cameraRotationStart = lastFrame.rotation;
						cameraRotationEnd = nextFrame.rotation;
						
						// Animate mouse strength
						mouseStrengthStart = mouseStrength;
						mouseStrengthEnd = nextFrame.mouseStrength;
						mouseStrengthDuration = cameraMoveDuration;
						mouseStrengthTime = cameraMoveTime;
					} else {
						//console.log("No frame", lastFrame && true, nextFrame && true);
					}
				}

			
				// Update camera pos/targets
				if(cameraPositionEnd && cameraRotationEnd && cameraMoveTime < cameraMoveDuration) {
					cameraMoveTime += renderDelta;
					//console.log(cameraMoveTime, cameraMoveDuration, cameraMoveTime/cameraMoveDuration);
					if(cameraMoveTime > cameraMoveDuration) cameraMoveTime = cameraMoveDuration;
					
					// Figure out transition amount
					var transition = (cameraMoveTime/cameraMoveDuration);
					
					// Ease
					cameraPosition.copy(cameraPositionStart).lerp(cameraPositionEnd, transition);
					cameraRotation.copy(cameraRotationStart).lerp(cameraRotationEnd, transition);
					
				}
				
				// Set the pos
				self.camera.position.copy(cameraPosition);
				self.camera.rotation.setFromVector3(cameraRotation, 'YXZ');
				
				// Adjust based on mouse movement
				if(mouseStrengthTime < mouseStrengthDuration) {
					mouseStrengthTime += renderDelta;
					mouseStrength = lerpVal(mouseStrengthStart, mouseStrengthEnd, mouseStrengthTime/mouseStrengthDuration, true);
				}
				
				if(mouseStrength) {
					var friction = mouseRotateFriction;
					var wav = (Math.sin(tick/100) + 1) / 2;
					friction /= wav * 0.7 + 0.3;
					
					var mouseDistX = targetMouseX - mouseX;
 					var mouseDistY = targetMouseY - mouseY;
					
					mouseSpeedX = (mouseSpeedX * friction + mouseDistX * 0.01) / (friction + 1);
					friction *= 0.1;
					mouseSpeedY = (mouseSpeedY * friction + mouseDistY * 0.01) / (friction + 1);
					
					mouseX += mouseSpeedX;
 					mouseY += mouseSpeedY;
 					
 					var modifiedMouseX = mouseX * (mouseY+0.5);
 					var modifiedMouseY = mouseY;
					
					// Pan
					self.camera.rotateOnAxis(new THREE.Vector3(0, 0.6, 0), modifiedMouseX * mouseStrength);
					
					// Roll
					self.camera.rotateOnAxis(new THREE.Vector3(0, 0, -0.2), modifiedMouseX * mouseStrength);
					
					// Pitch
					self.camera.rotateOnAxis(new THREE.Vector3(-0.7, 0, 0), modifiedMouseY * mouseStrength + Math.pow(Math.max(0, modifiedMouseY/-0.5), 2) * 0.5 * mouseStrength);
				
					self.camera.translateX(modifiedMouseX * 50 * mouseStrength);
					self.camera.translateZ(modifiedMouseY * 20 * mouseStrength);
				}
				
				// Look at the target
	 			//self.camera.lookAt(new THREE.Vector3(0, 20, 0));
			}
			
			// Update screen
			if(screenRenderCount !== self.screenRenderer.renderCount) {
				screenRenderCount = self.screenRenderer.renderCount;
				self.screenPlane.material.map.needsUpdate = true;
			}
			
			//self.mirror.render();
			if(self.oculusMode == true) {
				self.oculusEffect.render(self.scene, self.camera);
			} else {
				self.renderer.render(self.scene, self.camera);
			}

			//self.renderer.render(self.scene, self.camera);

		}
		
		var headTrackScale = 70;
		var headTrackOffset = new THREE.Vector3(0, 20, 50);
		
		this.playAnimation = function(animName, options) {
			options = options || {};
			var transitionIn = options.transitionIn || 0;
			var transitionOut = options.transitionOut || 0;
			var finalPosition = options.finalPosition || null;
			var finalRotation = options.finalRotation || null;
			var mouseIn = options.mouseIn || 0;
			var mouseOut = options.mouseOut || 0;
			var midMouseStrength = options.mouseStrength || 0;
			
			$.getJSON("/anim/"+animName+".json", function(data) {
				
				var smoothFrames = 5;
				var smoothFramesMin = 2;
				
				var positionTmp = new THREE.Vector3(0, 0, 0);
				var rotationTmp = new THREE.Vector3(0, 0, 0);
				
				var totalDuration = data[data.length-1].time;
				
				var newFrames = [];
				
				for(var index in data) {
					
					rotationTmp.x = 0;
					rotationTmp.y = 0;
					rotationTmp.z = 0;
					
					positionTmp.x = 0;
					positionTmp.y = 0;
					positionTmp.z = 0;
					
					var totalFrames = 0;
					
					for(var k = Math.max(0, index - smoothFrames); k < Math.min(index*1 + smoothFrames, data.length - 1); k++) {
						
						totalFrames++;
						
						var pos = data[k].position;
						var rot = data[k].rotation;
						
						rotationTmp.x += rot.pitch;
						rotationTmp.y += rot.yaw;
						rotationTmp.z += rot.roll;
						
						positionTmp.x += pos.x * headTrackScale + headTrackOffset.x;
						positionTmp.y += pos.y * headTrackScale + headTrackOffset.y;
						positionTmp.z += pos.z * headTrackScale + headTrackOffset.z;
						
					}
					
					rotationTmp.x /= totalFrames;
					rotationTmp.y /= totalFrames;
					rotationTmp.z /= totalFrames;
					
					positionTmp.x /= totalFrames;
					positionTmp.y /= totalFrames;
					positionTmp.z /= totalFrames;
					
					var frame = {
						mouseStrength: midMouseStrength,
						time: data[index].time,
						position: positionTmp.clone(),
						rotation: rotationTmp.clone()
					};
					
					// Apply transition in
					if(frame.time < transitionIn) {
						var transition = 1-(frame.time/transitionIn);
						frame.position.lerp(cameraPosition, transition);
						frame.rotation.lerp(cameraRotation, transition);
					}
					if(frame.time < mouseIn) {
						var transition = 1-(frame.time/mouseIn);
						frame.mouseStrength = midMouseStrength + transition * (1 - midMouseStrength);
					}
					
					// Apply transition out
					if(frame.time > totalDuration - transitionOut) {
						var transition = 1 - (totalDuration - frame.time) / transitionOut;
						frame.position.lerp(finalPosition, transition);
						frame.rotation.lerp(finalRotation, transition);
					}
					if(frame.time > totalDuration - mouseOut) {
						var transition = 1 - (totalDuration - frame.time) / mouseOut;
						console.log(transition);
						frame.mouseStrength = midMouseStrength + transition * (1 - midMouseStrength);
					}
					
					newFrames[index] = frame;
					
				}
				
				if(options.snapFirst) {
					cameraPosition = newFrames[0].position;
					cameraRotation = newFrames[1].rotation;
				}
				
				currentAnimationFrame = 0;
				animationTime = 0;
				animationFrames = newFrames;
				
				if(options.start) {
					options.start();
				}
			});
		}
		
		var interactiveObjects = {
			notebook: {
				clickMatch: /^Notebook/,
				click: function() {
					self.lookAt("notebook", "look-notebook")
				}
			},
			mug: {
				clickMatch: /^Mug/,
				click: function() {
					self.lookAt("mug", "look-mug")
				}
			},
			screen: {
				clickMatch: /^Monitor/,
				click: function() {
					self.lookAt("screen", "look-screen")
				}
			},
			floppy: {
				clickMatch: /^Floppy/,
				click: function() {
					self.lookAt("floppy", "look-floppy")
				}
			},
			floppyBay: {
				clickMatch: /FloppyBay/,
				click: function() {
					self.lookAt("floppyBay", "look-floppy-drive")
				}
			},
			keyboard: {
				clickMatch: /Keyboard/,
				click: function() {
					self.lookAt("keyboard", "look-keyboard")
				}
			}
		}
		
		this.lookAt = function(item, anim) {
			
			self.playAnimation(anim, {
				mouseIn: 3000,
				mouseOut: 2000,
				mouseStrength: 0,
				transitionIn: 4500,
				transitionOut: 3500,
				finalPosition: new THREE.Vector3(0, 25, 40),
				finalRotation: new THREE.Vector3(-0.3, 0, 0),
				complete: function() {
					console.log("Done playing");
				}
			});
			
		}
		
		this.init = function() {
			
			async.series([
				function initThree(next) {
					
					// Init the camera
					self.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
					
					self.renderer = new THREE.WebGLRenderer();
					self.renderer.shadowMapEnabled = true;
					//renderer.setPixelRatio( window.devicePixelRatio );
					self.renderer.setSize( window.innerWidth, window.innerHeight );
					document.body.appendChild(self.renderer.domElement);
					
					// Listen for window resize
					window.addEventListener('resize', self.updateWindowSize, false);
					
					// Listen for mouse movement
					window.addEventListener('mousemove', function(e) {
						targetMouseX = e.pageX / screenWidth - 0.5;
						targetMouseY = e.pageY / screenHeight - 0.5;
					});
					
					document.addEventListener('mouseleave', function(e) {
						targetMouseX = 0;
						targetMouseY = 0;
					});
					
					var raycaster = new THREE.Raycaster();
					
					window.addEventListener('click', function(e) {
						event.preventDefault();
						
						var mouse = new THREE.Vector2(
							(event.clientX / screenWidth) * 2 - 1,
							-(event.clientY / screenHeight) * 2 + 1
						);
						
						raycaster.setFromCamera(mouse, self.camera);
						
						var intersects = raycaster.intersectObjects(self.scene.children);
						
						if(intersects.length > 0) {
						
							var names = [];
							for(var k in intersects) {
								names.push(intersects[k].object.name);
							}							
							console.log("Intersects", names.join(", "));
							
							for(var k in intersects) {
								var obj = intersects[k].object;
								for(var m in interactiveObjects) {
									var type = interactiveObjects[m];
									if(type.clickMatch && type.clickMatch.test(obj.name)) {
										type.click();
									}
								}
							}
						
						}
						
					})
					
					next();
					
				},
				function initOculus(next) {
					require(["lib/three.oculus"], function() {
						self.oculusEffect = new THREE.OculusRiftEffect(self.renderer, {worldScale: 600});
						$(document).keydown(function(e) {
							if(e.keyCode == 79 && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								e.stopPropagation();
								self.oculusMode = !self.oculusMode;
								self.terminal.socket.emit("oculusMode", self.oculusMode);
								self.updateWindowSize();
							}
						})
						next();
					});
				},
				function initLoadManager(next) {
					
					self.loadManager = new THREE.LoadingManager();
					self.loadManager.onProgress = function(item, loaded, total) {
						console.log(item, loaded, total);
					};
					
					next();
					
				},
				function loadModels(next) {
					
					// Init load manager
					var onProgress = function(xhr) {
						if(xhr.lengthComputable) {
							var percentComplete = xhr.loaded / xhr.total * 100;
							console.log( Math.round(percentComplete, 2) + '% downloaded' );
						}
					};
			
					var onError = function(xhr) {
						console.log("Error", xhr);
					};
			
					// Load model
					var loader = new THREE.ObjectLoader(self.loadManager);
					loader.load('/3d/desk.json', function(scene) {
						
						self.scene = scene;
/*
						var material = new THREE.MeshLambertMaterial({
							color: 0xaa9999
						});
						
						var object = new THREE.Mesh(geom, material);
*/
						for(var k in scene.children) {
							var object = scene.children[k];
							self.meshObjects[object.name] = object;
						}
						window.meshes = [];
						scene.traverse(function(child) {
			
							if(child instanceof THREE.Mesh) {
								

								child.castShadow = true;
								child.receiveShadow = true;

								
// 								child.material.shading = THREE.FlatShading;

/*
								child.material = new THREE.MeshPhongMaterial({
									color: 0xffffff,
									vertexColors: THREE.FaceColors,
									shading: THREE.FlatShading,
								});
*/

								
							}
			
						} );
						
						
						self.scene.add(self.camera);
						
						window.scene = self;
						
						//self.scene.add(object);
						next();
					}, onProgress, onError);
					
				},
				
				function applyMaterials(next) {
					
					// Mug
					var mug = self.meshObjects['Mug']
					mug.material.map = THREE.ImageUtils.loadTexture("/3d/mug.jpg");
					mug.material.emissive = new THREE.Color(0.05, 0.05, 0.05);
					mug.material.needsUpdate = true;
					
					var keys = self.meshObjects['Keyboard_Keys'];
					keys.material.map = THREE.ImageUtils.loadTexture("/3d/mug.jpg");
					keys.material.needsUpdate = true;
					
/*
					self.meshObjects['Monitor'].material.shading = THREE.FlatShading;
					self.meshObjects['Keyboard Base'].material.shading = THREE.FlatShading;
					self.meshObjects['Keyboard Keys'].material.shading = THREE.FlatShading;
*/
					
					next();
					
				},
				
				function initReflection(next) {
					
/*
					require(['lib/three.mirror'], function() {
						self.mirror = new THREE.Mirror(self.renderer, self.camera, { clipBias: 0.003, textureWidth: 500, textureHeight: 500, color:0x889999 } );
						
						self.screenPlane = self.meshObjects.ScreenPlane;
						self.screenPlane.material = self.mirror.material;
						self.screenPlane.receiveShadow = false;
						self.screenPlane.castShadow = false;
						
						self.screenPlane.add(self.mirror);
						next();
					});
*/
					next();
					
				},
				
				function initScreen(next) {
					
					var texture = new THREE.Texture(self.screenRenderer.mainCanvas);
					texture.minFilter = THREE.LinearFilter;
					texture.minFilter = THREE.LinearFilter;
					
					var material = new THREE.MeshBasicMaterial({
						color: 0xffffff,
						side: THREE.DoubleSide,
						map: texture,
						shading: THREE.NoShading
					});
					
					self.meshObjects.ScreenPlane.material = material;
					
					self.screenPlane = self.meshObjects.ScreenPlane;
					
					self.screenPlane.receiveShadow = false;
					self.screenPlane.castShadow = false;
					
					self.screenEffectPlane = self.screenPlane.clone();
					self.scene.add(self.screenEffectPlane);
					self.screenEffectPlane.position.z += 1;
					
					var effectTexture = THREE.ImageUtils.loadTexture( "/3d/screen-texture.png");
					effectTexture.wrapS = THREE.RepeatWrapping;
					effectTexture.wrapT = THREE.RepeatWrapping;
					effectTexture.repeat.set(8, 8);
					
					self.screenEffectPlane.material = new THREE.MeshBasicMaterial({
						color: 0xffffff,
						transparent: true,
						side: THREE.DoubleSide,
						map: effectTexture,
						shading: THREE.NoShading
					});
					
					next();
				},
				
				function initLighting(next) {
					
					// Spotlight for dramatic effect/shadows
					var spotlight = self.spotlight = new THREE.SpotLight( 0xffffff );
					spotlight.position.set(-15, 30, 37);
					spotlight.intensity = 0.8;
					
					spotlight.castShadow = true;
					
					spotlight.shadowMapWidth = 1024;
					spotlight.shadowMapHeight = 1024;
					
					spotlight.shadowCameraNear = 1;
					spotlight.shadowCameraFar = 200;
					spotlight.shadowCameraFov = 80;
					
					//spotlight.lookAt(new THREE.Vector3(-20, 0, 0));
					
					self.scene.add(spotlight);
					
					next();
					
				},
				function beginAnimating() {
					self.updateWindowSize();
					self.playAnimation("head-intro-4", {
						mouseIn: 10,
						mouseOut: 1000,
						transitionIn: 1,
						transitionOut: 3000,
						snapFirst: true,
						finalPosition: new THREE.Vector3(0, 25, 40),
						finalRotation: new THREE.Vector3(-0.3, 0, 0),
						start: function() {
							self.animate();
						}
					});
				}
			]);
			
		}
		
		this.setScreenRenderer = function(renderer) {
			self.screenRenderer = renderer;
		}
		
		self.eulerOrder = "YXZ";
		
		this.setTerminal = function(terminal) {
			self.terminal = terminal;
			terminal.commands.updateCamera = function(item) {
				cameraSetManually = true;
				
				self.camera.position.x = headTrackOffset.x + headTrackScale * item.position.x;
				self.camera.position.y = headTrackOffset.y + headTrackScale * item.position.y;
				self.camera.position.z = headTrackOffset.z + headTrackScale * item.position.z;
				
				self.camera.setRotationFromEuler(new THREE.Euler(item.rotation.pitch, item.rotation.yaw, item.rotation.roll, self.eulerOrder));
			}
		}
		
	}
	
	return TerminalScene;
	
});