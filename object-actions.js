import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { checkAssets } from "./assets.js";

// Cache for sound effect audio
let kickThrowSound = null;
let soundLoaded = false;

/**
 * Load the kick/throw sound effect
 */
export async function initializeKickThrowSound() {
  if (soundLoaded) return;
  
  try {
    const soundURL = await checkAssets('beach-ball.mp3');
    kickThrowSound = new Audio(soundURL);
    kickThrowSound.preload = 'auto';
    kickThrowSound.volume = 0.5; // Set reasonable volume
    soundLoaded = true;
    console.log('- Loaded kick/throw sound effect');
  } catch (error) {
    console.warn('Failed to load kick/throw sound effect:', error);
  }
}

/**
 * Play the kick/throw sound effect
 */
function playKickThrowSound() {
  if (!kickThrowSound || !soundLoaded) return;
  
  // Clone the audio to allow overlapping sounds
  const soundClone = kickThrowSound.cloneNode();
  soundClone.volume = kickThrowSound.volume;
  soundClone.play().catch(error => {
    // Ignore play() errors (e.g., user hasn't interacted with page yet)
    console.debug('Could not play sound effect:', error);
  });
}

/**
 * Kick dynamic objects away from the viewer
 * Only affects objects within kick distance
 * @param {SparkScene} sparkScene - The spark scene
 * @param {number} kickDistance - Maximum distance to kick objects (default: 2.0 meters)
 * @param {number} kickForce - Force of the kick (default: 10.0)
 */
export function kickDynamicObjects(sparkScene, kickDistance = 5.0, kickForce = 10.0) {
  if (!sparkScene.physicsWorld) {
    console.warn("Physics world not initialized");
    return;
  }
  
  // Get camera world position (camera is child of localFrame)
  const cameraWorldPos = new THREE.Vector3();
  sparkScene.camera.getWorldPosition(cameraWorldPos);
  
  let kickedCount = 0;
  sparkScene.dynamicObjects.forEach(({ body, mesh }, name) => {
    if (body && mesh) {
      // Get object position
      const objPosition = new THREE.Vector3();
      objPosition.copy(mesh.position);
      
      // Calculate distance from camera to object
      const distance = cameraWorldPos.distanceTo(objPosition);
      
      // Only kick if object is within kick distance
      if (distance <= kickDistance && distance > 0) {
        // Calculate direction away from camera (from camera to object)
        const direction = new THREE.Vector3()
          .subVectors(objPosition, cameraWorldPos)
          .normalize();
        
        // Add slight upward component for more natural kick
        direction.y += 0.2;
        direction.normalize();
        
        // Calculate impulse (stronger for closer objects)
        const distanceFactor = 1.0 - (distance / kickDistance); // 1.0 at camera, 0.0 at max distance
        const force = kickForce * distanceFactor;
        
        const impulse = new RAPIER.Vector3(
          direction.x * force,
          direction.y * force,
          direction.z * force
        );
        
        // Apply impulse
        body.applyImpulse(impulse, true);
        
        kickedCount++;
        console.log(`- Kicked "${name}" with force ${force.toFixed(2)} (distance: ${distance.toFixed(2)}m)`);
      }
    }
  });
  
  if (kickedCount > 0) {
    console.log(`✓ Kicked ${kickedCount} dynamic object(s)`);
    playKickThrowSound();
  } else {
    console.log(`No objects within kick distance (${kickDistance}m)`);
  }
}

/**
 * Throw dynamic objects away from the viewer with a high arc
 * Only affects objects within throw distance
 * @param {SparkScene} sparkScene - The spark scene
 * @param {number} throwDistance - Maximum distance to throw objects (default: 5.0 meters)
 * @param {number} throwForce - Force of the throw (default: 12.0)
 */
export function throwDynamicObjects(sparkScene, throwDistance = 5.0, throwForce = 20.0) {
  if (!sparkScene.physicsWorld) {
    console.warn("Physics world not initialized");
    return;
  }
  
  // Get camera world position (camera is child of localFrame)
  const cameraWorldPos = new THREE.Vector3();
  sparkScene.camera.getWorldPosition(cameraWorldPos);
  
  // Get camera forward direction in world space (camera is child of localFrame)
  const cameraWorldQuaternion = new THREE.Quaternion();
  sparkScene.camera.getWorldQuaternion(cameraWorldQuaternion);
  const cameraForward = new THREE.Vector3(0, 0, -1);
  cameraForward.applyQuaternion(cameraWorldQuaternion);
  
  let thrownCount = 0;
  sparkScene.dynamicObjects.forEach(({ body, mesh }, name) => {
    if (body && mesh) {
      // Get object position
      const objPosition = new THREE.Vector3();
      objPosition.copy(mesh.position);
      
      // Calculate distance from camera to object
      const distance = cameraWorldPos.distanceTo(objPosition);
      
      // Only throw if object is within throw distance
      if (distance <= throwDistance && distance > 0) {
        // Calculate direction away from camera (from camera to object)
        const direction = new THREE.Vector3()
          .subVectors(objPosition, cameraWorldPos)
          .normalize();
        
        // For throwing, use camera forward direction with very strong upward component for high arc
        const throwDirection = new THREE.Vector3();
        throwDirection.copy(cameraForward);
        
        // Add very strong upward component for much higher arc
        throwDirection.y += 1.0; // Much higher arc than kick (which uses 0.2)
        throwDirection.normalize();
        
        // Calculate impulse (stronger for closer objects)
        const distanceFactor = 1.0 - (distance / throwDistance); // 1.0 at camera, 0.0 at max distance
        const force = throwForce * distanceFactor;
        
        const impulse = new RAPIER.Vector3(
          throwDirection.x * force,
          throwDirection.y * force,
          throwDirection.z * force
        );
        
        // Apply impulse
        body.applyImpulse(impulse, true);
        
        thrownCount++;
        console.log(`- Threw "${name}" with force ${force.toFixed(2)} (distance: ${distance.toFixed(2)}m)`);
      }
    }
  });
  
  if (thrownCount > 0) {
    console.log(`✓ Threw ${thrownCount} dynamic object(s)`);
    playKickThrowSound();
  } else {
    console.log(`No objects within throw distance (${throwDistance}m)`);
  }
}

/**
 * Initialize keyboard handlers for object actions (kick and throw)
 * @param {SparkScene} sparkScene - The spark scene
 * @param {object} sceneConfig - Scene configuration with flags
 */
export function initializeObjectActionKeyHandlers(sparkScene, sceneConfig) {
  if (!sceneConfig.flags.enableDynamicObjects) {
    return; // Skip if dynamic objects are not enabled
  }

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
}

