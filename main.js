// Scene selection - change this to load a different scene
const SCENE_NAME = 'worldship';

import { createCheckSceneAssets } from "./assets-config.js";
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
import { initializeKickThrowSound, initializeObjectActionKeyHandlers } from "./object-actions.js";
import { initializeThrowHands, updateThrowHands } from "./throw-hand.js";
import { initializeCharacterPhysics, updateCharacterPhysics, initializeJumpKeyHandler } from "./character-physics.js";

// Load scene-specific config
const sceneConfig = await import(`./scenes/${SCENE_NAME}/config.js`);
const { SCENE_CONFIG, CONTROLS_CONFIG, RENDER_CONFIG, ASSETS_CONFIG } = sceneConfig;

// Create asset resolver with scene-specific config
// The function will first check the scene directory, then the local filesystem, and finally
// the CDN. Paths are located in the config.js file.
const checkSceneAssets = createCheckSceneAssets(SCENE_NAME, ASSETS_CONFIG);

// Show progress overlay
showProgress("Loading splats...");

// Create spark scene with progress tracking
const splatURL = await checkSceneAssets(SCENE_CONFIG.sceneSpzFileName);
const sparkScene = await createSparkScene(splatURL, {
  onProgress: (progress, loadedBytes, totalBytes) => {
    updateProgress(progress, loadedBytes, totalBytes);
  }
}, RENDER_CONFIG);

// Hide progress overlay
hideProgress();

// Initialize background audio. This is played at a constant volume throughout the scene
await initializeBackgroundAudio(SCENE_NAME, SCENE_CONFIG, checkSceneAssets);

await initializeSpatialAudio(sparkScene, SCENE_CONFIG.configFiles.audioConfig, checkSceneAssets);

// Initialize lighting if enabled
if (SCENE_CONFIG.flags.enableLighting) {
  await initializeLighting(sparkScene, SCENE_CONFIG.configFiles.lightingConfig, checkSceneAssets);
}

// Initialize collisions (must be before objects so physics world exists)
if (SCENE_CONFIG.flags.enablePhysics) {
  console.log('Initializing collisions with proxy mesh', SCENE_CONFIG.proxyMeshFileName);
  await initializeCollisions(sparkScene, SCENE_CONFIG.proxyMeshFileName, checkSceneAssets);
}

// Initialize objects (only if dynamic objects are enabled)
if (SCENE_CONFIG.flags.enableDynamicObjects) {
  await initializeObjects(sparkScene, SCENE_CONFIG.configFiles.objectsConfig, checkSceneAssets);
}

// Initialize droid that roams the ship
// await initializeRobot(sparkScene, SCENE_CONFIG.configFiles.robotConfig, checkSceneAssets);

// Apply scene rotation from config
sparkScene.gsplatscene.rotation.set(
  SCENE_CONFIG.sceneRotation.x,
  SCENE_CONFIG.sceneRotation.y,
  SCENE_CONFIG.sceneRotation.z
);
if (sparkScene.collisionmesh) {
  sparkScene.collisionmesh.rotation.set(
    SCENE_CONFIG.sceneRotation.x,
    SCENE_CONFIG.sceneRotation.y,
    SCENE_CONFIG.sceneRotation.z
  );
  // Create physics bodies after rotation is applied
  if (SCENE_CONFIG.flags.enablePhysics) {
    createCollisionPhysicsBodies(sparkScene);
  }
}

// Set player starting position from config
sparkScene.localFrame.position.set(
  SCENE_CONFIG.playerStartPosition.x,
  SCENE_CONFIG.playerStartPosition.y,
  SCENE_CONFIG.playerStartPosition.z
); 

// Initialize VR if enabled
if (SCENE_CONFIG.flags.enableVR) {
  initializeVR(sparkScene, {}, RENDER_CONFIG);
}

// Controls get reset if initializing VR so set control speed after
sparkScene.controls.fpsMovement.moveSpeed *= CONTROLS_CONFIG.moveSpeedMultiplier; 

// Initialize HUD if enabled
if (SCENE_CONFIG.flags.enableHUD) {
  initializeHUD();
}

// SDF Hands uses SDF edits to allow "touching" of the scene in VR
if (SCENE_CONFIG.flags.enableHands) {
  initializeSDFHands(sparkScene);
}

// Initialize throw hands and dynamic objects if enabled
if (SCENE_CONFIG.flags.enableDynamicObjects) {
  initializeThrowHands(sparkScene);
  await initializeKickThrowSound();
}

// Initialize character physics (toggle to enable walking with collisions)
if (SCENE_CONFIG.flags.enablePhysics) {
  initializeCharacterPhysics(sparkScene);
  initializeJumpKeyHandler(sparkScene, SCENE_CONFIG);
}

// Initialize keyboard handlers for object actions (kick and throw)
initializeObjectActionKeyHandlers(sparkScene, SCENE_CONFIG);

// with VR, we need to wait for a user gesture to start music.  Otherwise, start music immediately.
if (!sparkScene.xrHands) {
  await turnMusicOn();
} 

// Start animation loop
let lastPhysicsTime = null;
startAnimationLoop(sparkScene, (sparkSceneIn, time) => {
  // Update physics (convert milliseconds to seconds)
  if (SCENE_CONFIG.flags.enablePhysics && lastPhysicsTime !== null) {
    const deltaTime = (time - lastPhysicsTime) / 1000; // Convert to seconds
    updateCollisions(sparkSceneIn, deltaTime);
    
    // Update dynamic objects if enabled
    if (SCENE_CONFIG.flags.enableDynamicObjects) {
      updateDynamicObjects(sparkSceneIn); // Sync visual meshes with physics bodies
    }
    
    updateCharacterPhysics(sparkSceneIn, deltaTime); // Character collisions and movement
  }
  lastPhysicsTime = time;
  
  // updateRobot(time);
  
  // Update SDF hands if enabled
  if (SCENE_CONFIG.flags.enableHands) {
    updateSDFHands(sparkSceneIn, time);
  }
  
  // Update throw hands if dynamic objects are enabled
  if (SCENE_CONFIG.flags.enableDynamicObjects) {
    updateThrowHands(sparkSceneIn, time); // VR ball grabbing/throwing
  }
  
  // Update HUD if enabled
  if (SCENE_CONFIG.flags.enableHUD) {
    updateHUD(sparkSceneIn.localFrame.position);
  }
  
  checkProximityTriggers(sparkSceneIn.localFrame.position); // audio triggers
});

