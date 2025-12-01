import { checkAssets } from "./assets.js";
import { initializeBackgroundAudio, turnMusicOn } from "./audio.js";
import { createSparkScene, initializeVR, startAnimationLoop } from "./scene.js";
import { initializeHUD, updateHUD } from "./hud.js";
import { initializeSDFHands, updateSDFHands } from "./sdf-hand.js";
import { initializeSpatialAudio, checkProximityTriggers } from "./spatial-audio.js";
import { showProgress, updateProgress, hideProgress } from "./progress.js";
import { initializeRobot, updateRobot } from "./robot.js";
import { initializeLighting } from "./lighting.js";
import { initializeObjects } from "./objects.js";
import { initializeCollisions, updateCollisions, updateDynamicObjects, createCollisionPhysicsBodies } from "./collisions.js";
import { kickDynamicObjects, throwDynamicObjects } from "./object-actions.js";
import { initializeThrowHands, updateThrowHands } from "./throw-hand.js";

// Show progress overlay
showProgress("Loading splats...");

// Create spark scene with progress tracking
const splatURL = await checkAssets('cozy_ship-lod.spz');
const sparkScene = await createSparkScene(splatURL, {
  onProgress: (progress, loadedBytes, totalBytes) => {
    updateProgress(progress, loadedBytes, totalBytes);
  }
});

// Hide progress overlay
hideProgress();

// Initialize background audio. This is played at a constant volume throughout the scene
// const audioURL = await checkAssets('background.mp3');
// await initializeBackgroundAudio(audioURL);

// No background audio, only spatial audio
await initializeBackgroundAudio(null);

await initializeSpatialAudio(sparkScene, 'audio-config.json', checkAssets);
await initializeLighting(sparkScene, 'lighting-config.json', checkAssets);

// Initialize collisions (must be before objects so physics world exists)
await initializeCollisions(sparkScene, 'cozy_space_ship_mesh.glb', checkAssets);
await initializeObjects(sparkScene, 'objects-config.json', checkAssets);

// Initialize droid that roams the ship
await initializeRobot(sparkScene, 'robot-config.json', checkAssets);

// Tweaks the scenes based on cozy_ship-lod.spz which is upside down for some reason
sparkScene.gsplatscene.rotation.y = -Math.PI / 2; // this splat needs rotation to align
if (sparkScene.collisionmesh) {
  sparkScene.collisionmesh.rotation.y = -Math.PI / 2; // match collision mesh rotation to splat
  // Create physics bodies after rotation is applied
  createCollisionPhysicsBodies(sparkScene);
}

// Start in the bedroom
sparkScene.localFrame.position.set(-2, 7, -6.13); 

// Initialize VR
initializeVR(sparkScene);

// controls get reset if initializing VR so set control speed after
sparkScene.controls.fpsMovement.moveSpeed *= 3.0; 

// Initialize HUD
initializeHUD();

// SDFHAnds uses SDF edits to allow "touching" of the scene in VR. Uncomment to play around with it. 
// initializeSDFHands(sparkScene);

// Ability to throw objects in VR
initializeThrowHands(sparkScene);

// Debug keyboard controls
window.addEventListener('keydown', (event) => {
  // Press 'k' to kick nearby dynamic objects away from viewer
  if (event.key === 'k' || event.key === 'K') {
    kickDynamicObjects(sparkScene);
  }
  // Press 't' to throw nearby dynamic objects with high arc
  if (event.key === 't' || event.key === 'T') {
    throwDynamicObjects(sparkScene);
  }
});

// with VR, we need to wait for a user gesture to start music.  Otherwise, start music immediately.
if (!sparkScene.xrHands) {
  await turnMusicOn();
} 

// Start animation loop
let lastPhysicsTime = null;
startAnimationLoop(sparkScene, (sparkSceneIn, time) => {
  // Update physics (convert milliseconds to seconds)
  if (lastPhysicsTime !== null) {
    const deltaTime = (time - lastPhysicsTime) / 1000; // Convert to seconds
    updateCollisions(sparkSceneIn, deltaTime);
    updateDynamicObjects(sparkSceneIn); // Sync visual meshes with physics bodies
  }
  lastPhysicsTime = time;
  
  updateRobot(time);
  // updateSDFHands(sparkSceneIn, time);
  updateThrowHands(sparkSceneIn, time); // VR ball grabbing/throwing
  updateHUD(sparkSceneIn.localFrame.position);
  checkProximityTriggers(sparkSceneIn.localFrame.position); // audio triggers
});

