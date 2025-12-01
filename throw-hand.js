import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { getAllDynamicObjects } from "./collisions.js";

// Grab configuration
const GRAB_DISTANCE = 0.15; // Distance from hand to grab a ball
const PINCH_THRESHOLD = 0.04; // Distance between thumb and index to trigger pinch
const VELOCITY_HISTORY_SIZE = 5; // Number of frames to average for throw velocity
const THROW_MULTIPLIER = 2.0; // Multiply velocity for stronger throws

// State for each hand
const handStates = {
  left: {
    isPinching: false,
    grabbedObject: null,
    velocityHistory: [],
    lastPosition: new THREE.Vector3(),
    pinchPosition: new THREE.Vector3()
  },
  right: {
    isPinching: false,
    grabbedObject: null,
    velocityHistory: [],
    lastPosition: new THREE.Vector3(),
    pinchPosition: new THREE.Vector3()
  }
};

let sparkSceneRef = null;
let lastTime = 0;

/**
 * Initialize throw hand tracking
 * @param {SparkScene} sparkScene - The spark scene
 */
export function initializeThrowHands(sparkScene) {
  sparkSceneRef = sparkScene;
  console.log("- Throw hands initialized");
}

/**
 * Get the pinch position (midpoint between thumb tip and index tip)
 * @param {object} hand - Hand joint data from xrHands
 * @returns {THREE.Vector3|null} - Pinch position or null if joints not available
 */
function getPinchPosition(hand) {
  if (!hand || !hand.t3 || !hand.i4) return null;
  
  const thumbTip = hand.t3.position;
  const indexTip = hand.i4.position;
  
  return new THREE.Vector3(
    (thumbTip.x + indexTip.x) / 2,
    (thumbTip.y + indexTip.y) / 2,
    (thumbTip.z + indexTip.z) / 2
  );
}

/**
 * Check if hand is in pinch gesture
 * @param {object} hand - Hand joint data from xrHands
 * @returns {boolean} - True if pinching
 */
function isPinching(hand) {
  if (!hand || !hand.t3 || !hand.i4) return false;
  
  const thumbTip = hand.t3.position;
  const indexTip = hand.i4.position;
  
  const distance = thumbTip.distanceTo(indexTip);
  return distance < PINCH_THRESHOLD;
}

/**
 * Find the nearest grabbable object to a position
 * @param {SparkScene} sparkScene - The spark scene
 * @param {THREE.Vector3} position - Position to search from
 * @returns {object|null} - { name, object } or null if none in range
 */
function findNearestGrabbable(sparkScene, position) {
  const dynamicObjects = getAllDynamicObjects(sparkScene);
  let nearest = null;
  let nearestDistance = GRAB_DISTANCE;
  
  dynamicObjects.forEach((obj, name) => {
    if (!obj.mesh || !obj.body) return;
    
    // Skip if already grabbed by other hand
    if (handStates.left.grabbedObject?.name === name || 
        handStates.right.grabbedObject?.name === name) {
      return;
    }
    
    const objPosition = new THREE.Vector3();
    objPosition.copy(obj.mesh.position);
    
    const distance = position.distanceTo(objPosition);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { name, object: obj };
    }
  });
  
  return nearest;
}

/**
 * Grab an object with a hand
 * @param {string} handName - 'left' or 'right'
 * @param {object} target - { name, object } to grab
 */
function grabObject(handName, target) {
  const state = handStates[handName];
  const { body } = target.object;
  
  // Make the body kinematic so it follows the hand
  body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
  
  // Reset velocity
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  
  state.grabbedObject = target;
  state.velocityHistory = [];
  
  console.log(`- Grabbed "${target.name}" with ${handName} hand`);
}

/**
 * Release a grabbed object with velocity
 * @param {string} handName - 'left' or 'right'
 */
function releaseObject(handName) {
  const state = handStates[handName];
  if (!state.grabbedObject) return;
  
  const { body } = state.grabbedObject.object;
  
  // Calculate average velocity from history
  const avgVelocity = new THREE.Vector3(0, 0, 0);
  if (state.velocityHistory.length > 0) {
    state.velocityHistory.forEach(v => avgVelocity.add(v));
    avgVelocity.divideScalar(state.velocityHistory.length);
    avgVelocity.multiplyScalar(THROW_MULTIPLIER);
  }
  
  // Make the body dynamic again
  body.setBodyType(RAPIER.RigidBodyType.Dynamic);
  
  // Apply throw velocity
  body.setLinvel({ x: avgVelocity.x, y: avgVelocity.y, z: avgVelocity.z }, true);
  
  // Add some spin for realism
  body.setAngvel({ 
    x: (Math.random() - 0.5) * 5, 
    y: (Math.random() - 0.5) * 5, 
    z: (Math.random() - 0.5) * 5 
  }, true);
  
  console.log(`- Released "${state.grabbedObject.name}" with velocity [${avgVelocity.x.toFixed(2)}, ${avgVelocity.y.toFixed(2)}, ${avgVelocity.z.toFixed(2)}]`);
  
  state.grabbedObject = null;
  state.velocityHistory = [];
}

/**
 * Update throw hand tracking each frame
 * @param {SparkScene} sparkScene - The spark scene
 * @param {number} time - Current time in milliseconds
 */
export function updateThrowHands(sparkScene, time) {
  if (!sparkScene.renderer.xr.isPresenting || !sparkScene.xrHands) return;
  
  const deltaTime = (time - lastTime) / 1000; // Convert to seconds
  lastTime = time;
  
  // Skip first frame (no valid deltaTime)
  if (deltaTime <= 0 || deltaTime > 0.5) return;
  
  // Process each hand
  for (const handName of ['left', 'right']) {
    const hand = sparkScene.xrHands.hands[handName];
    const state = handStates[handName];
    
    if (!hand) continue;
    
    // Get current pinch position
    const pinchPos = getPinchPosition(hand);
    if (!pinchPos) continue;
    
    // Transform pinch position from local frame to world space
    const worldPinchPos = pinchPos.clone();
    sparkScene.localFrame.localToWorld(worldPinchPos);
    
    // Calculate velocity
    if (state.lastPosition.lengthSq() > 0) {
      const velocity = new THREE.Vector3()
        .subVectors(worldPinchPos, state.lastPosition)
        .divideScalar(deltaTime);
      
      // Add to velocity history (keep limited size)
      state.velocityHistory.push(velocity.clone());
      if (state.velocityHistory.length > VELOCITY_HISTORY_SIZE) {
        state.velocityHistory.shift();
      }
    }
    state.lastPosition.copy(worldPinchPos);
    state.pinchPosition.copy(worldPinchPos);
    
    // Check pinch state
    const currentlyPinching = isPinching(hand);
    
    // Pinch started
    if (currentlyPinching && !state.isPinching) {
      state.isPinching = true;
      
      // Try to grab nearby object
      if (!state.grabbedObject) {
        const target = findNearestGrabbable(sparkScene, worldPinchPos);
        if (target) {
          grabObject(handName, target);
        }
      }
    }
    
    // Pinch ended
    if (!currentlyPinching && state.isPinching) {
      state.isPinching = false;
      
      // Release grabbed object
      if (state.grabbedObject) {
        releaseObject(handName);
      }
    }
    
    // Update grabbed object position
    if (state.grabbedObject) {
      const { body } = state.grabbedObject.object;
      body.setNextKinematicTranslation({ 
        x: worldPinchPos.x, 
        y: worldPinchPos.y, 
        z: worldPinchPos.z 
      });
    }
  }
}

/**
 * Check if either hand is currently grabbing an object
 * @returns {boolean} - True if any hand is grabbing
 */
export function isGrabbing() {
  return handStates.left.grabbedObject !== null || 
         handStates.right.grabbedObject !== null;
}

/**
 * Get the state of both hands
 * @returns {object} - Hand states
 */
export function getHandStates() {
  return handStates;
}

