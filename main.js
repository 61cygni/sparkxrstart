import { checkAssets } from "./assets.js";
import { initializeBackgroundAudio, turnMusicOn } from "./audio.js";
import { createSparkScene, initializeVR, startAnimationLoop } from "./scene.js";
import { initializeHUD, updateHUD } from "./hud.js";
import { initializeSDFHands, updateSDFHands } from "./sdf-hand.js";
import { initializeSpatialAudio, checkProximityTriggers } from "./spatial-audio.js";

// Create spark scene
const splatURL = await checkAssets('cozy_ship-lod.spz');
const sparkScene = await createSparkScene(splatURL);

// Initialize background audio. This is played at a constant volume throughout the scene
// const audioURL = await checkAssets('background.mp3');
// await initializeBackgroundAudio(audioURL);
await initializeBackgroundAudio(null);

// Initialize spatial audio
await initializeSpatialAudio(sparkScene, 'audio-config.json', checkAssets);

// Tweaks the scenes based on cozy_ship-lod.spz
sparkScene.background.rotation.y = -Math.PI / 2; // this splats is upside down for whatever reason
sparkScene.localFrame.position.set(-2, 7, -6.13); // start in the bedroom

// Initialize VR
initializeVR(sparkScene);

// controls get reset if initializing VR so set control speed after
sparkScene.controls.fpsMovement.moveSpeed *= 3.0; 

// Initialize HUD
initializeHUD();

// Initialize SDF hand tracking
initializeSDFHands(sparkScene);

// with VR, we need to wait for a user gesture to start music.  Otherwise, start music immediately.
if (!sparkScene.xrHands) {
  await turnMusicOn();
} 

// Start animation loop
startAnimationLoop(sparkScene, (sparkSceneIn, time) => {
  updateSDFHands(sparkSceneIn, time);
  updateHUD(sparkSceneIn.localFrame.position);
  checkProximityTriggers(sparkSceneIn.localFrame.position);
});

