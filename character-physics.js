import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";

// Character physics state
let characterBody = null;
let characterCollider = null;
let physicsEnabled = false;
let isGrounded = false;
let sparkSceneRef = null;

// Character configuration
const CHARACTER_CONFIG = {
  height: 2.7,        // Total height in meters
  radius: 0.3,        // Capsule radius
  mass: 70,           // Mass in kg
  jumpForce: 7.0,     // Jump impulse
  groundCheckDist: 0.1, // Distance to check for ground
  maxSlopeAngle: 45,  // Maximum walkable slope in degrees
};

// Listeners for physics toggle
const physicsToggleListeners = new Set();

/**
 * Register a listener for physics toggle events
 * @param {function} callback - Callback receives (isEnabled: boolean)
 */
export function onPhysicsToggle(callback) {
  physicsToggleListeners.add(callback);
}

/**
 * Unregister a physics toggle listener
 * @param {function} callback
 */
export function offPhysicsToggle(callback) {
  physicsToggleListeners.delete(callback);
}

/**
 * Notify all listeners of physics toggle
 */
function notifyPhysicsToggleListeners() {
  physicsToggleListeners.forEach(callback => callback(physicsEnabled));
}

/**
 * Check if character physics is enabled
 * @returns {boolean}
 */
export function isPhysicsEnabled() {
  return physicsEnabled;
}

/**
 * Sync physics toggle button icon
 */
function syncPhysicsToggle() {
  const button = document.getElementById("physics-toggle");
  if (!button) return;
  
  // Use footprints icon when physics enabled (walking), ghost when disabled (fly-through)
  button.innerHTML = physicsEnabled 
    ? '<i data-lucide="footprints"></i>' 
    : '<i data-lucide="ghost"></i>';
  button.setAttribute("aria-label", physicsEnabled ? "Disable physics (fly mode)" : "Enable physics (walk mode)");
  
  // Re-initialize icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Toggle character physics on/off
 */
export function togglePhysics() {
  if (!sparkSceneRef || !sparkSceneRef.physicsWorld) {
    console.warn("Cannot toggle physics: physics world not initialized");
    return;
  }
  
  physicsEnabled = !physicsEnabled;
  
  if (physicsEnabled) {
    // Create character body if it doesn't exist
    if (!characterBody) {
      createCharacterBody(sparkSceneRef);
    }
    
    // Teleport character to current camera position
    const cameraWorldPos = new THREE.Vector3();
    sparkSceneRef.camera.getWorldPosition(cameraWorldPos);
    
    // Position character slightly above current position to avoid clipping
    characterBody.setTranslation(
      { x: cameraWorldPos.x, y: cameraWorldPos.y, z: cameraWorldPos.z },
      true
    );
    characterBody.setLinvel({ x: 0, y: 0, z: 0 }, true); // Reset velocity
    
    console.log("- Character physics enabled");
  } else {
    console.log("- Character physics disabled (fly mode)");
  }
  
  syncPhysicsToggle();
  notifyPhysicsToggleListeners();
}

/**
 * Create the character physics body
 * @param {SparkScene} sparkScene
 */
function createCharacterBody(sparkScene) {
  if (!sparkScene.physicsWorld) {
    console.warn("Cannot create character body: physics world not initialized");
    return;
  }
  
  // Get initial position from camera
  const cameraWorldPos = new THREE.Vector3();
  sparkScene.camera.getWorldPosition(cameraWorldPos);
  
  // Create dynamic rigid body for character
  // Use a capsule shape (cylinder with hemispherical caps)
  const halfHeight = (CHARACTER_CONFIG.height - 2 * CHARACTER_CONFIG.radius) / 2;
  
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(cameraWorldPos.x, cameraWorldPos.y, cameraWorldPos.z)
    .lockRotations() // Prevent character from tipping over
    .setLinearDamping(0.5) // Some air resistance
    .setCcdEnabled(true); // Continuous collision detection for fast movement
  
  characterBody = sparkScene.physicsWorld.createRigidBody(bodyDesc);
  
  // Create capsule collider
  const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, CHARACTER_CONFIG.radius)
    .setMass(CHARACTER_CONFIG.mass)
    .setFriction(0.0) // Low friction to prevent sticking to walls
    .setRestitution(0.0); // No bounce
  
  characterCollider = sparkScene.physicsWorld.createCollider(colliderDesc, characterBody);
  
  console.log(`- Created character physics body (height: ${CHARACTER_CONFIG.height}m, radius: ${CHARACTER_CONFIG.radius}m)`);
}

/**
 * Check if character is on the ground
 * @param {SparkScene} sparkScene
 * @returns {boolean}
 */
function checkGrounded(sparkScene) {
  if (!characterBody || !sparkScene.physicsWorld) return false;
  
  // Check vertical velocity - if moving up significantly, not grounded
  const velocity = characterBody.linvel();
  if (velocity.y > 0.5) {
    return false;
  }
  
  const translation = characterBody.translation();
  
  // Cast a ray downward from slightly below character center
  const halfHeight = (CHARACTER_CONFIG.height - 2 * CHARACTER_CONFIG.radius) / 2;
  
  // Start ray from bottom of capsule
  const rayOrigin = { 
    x: translation.x, 
    y: translation.y - halfHeight - CHARACTER_CONFIG.radius + 0.05, // Just inside bottom of capsule
    z: translation.z 
  };
  const rayDir = { x: 0, y: -1, z: 0 };
  
  // Short ray to check for ground just below feet
  const rayLength = CHARACTER_CONFIG.groundCheckDist + 0.1;
  
  const ray = new RAPIER.Ray(rayOrigin, rayDir);
  
  // Use a filter to exclude the character's own collider
  const filterFlags = undefined;
  const filterGroups = undefined;
  const filterExcludeCollider = characterCollider;
  
  const hit = sparkScene.physicsWorld.castRay(
    ray,
    rayLength,
    true, // solid
    filterFlags,
    filterGroups,
    filterExcludeCollider
  );
  
  return hit !== null;
}

/**
 * Make the character jump
 */
export function jump() {
  if (!physicsEnabled || !characterBody) return;

  console.log("Jump!", isGrounded);
  
  if (isGrounded) {
    // Apply upward impulse
    const impulse = { x: 0, y: CHARACTER_CONFIG.jumpForce * CHARACTER_CONFIG.mass, z: 0 };
    characterBody.applyImpulse(impulse, true);
    isGrounded = false;
    console.log("Jump!");
  }
}

/**
 * Initialize keyboard handler for jump action
 * @param {SparkScene} sparkScene
 * @param {object} sceneConfig - Scene configuration with flags
 */
export function initializeJumpKeyHandler(sparkScene, sceneConfig) {
  if (!sceneConfig.flags.enablePhysics) {
    return; // Skip if physics is not enabled
  }

  window.addEventListener('keydown', (event) => {
    // Press Space to jump (when physics enabled)
    if (event.code === 'Space' && isPhysicsEnabled()) {
      event.preventDefault(); // Prevent page scroll
      jump();
    }
  });
}

/**
 * Initialize character physics system
 * @param {SparkScene} sparkScene
 */
export function initializeCharacterPhysics(sparkScene) {
  sparkSceneRef = sparkScene;
  
  // Setup toggle button
  const button = document.getElementById("physics-toggle");
  if (button) {
    button.addEventListener("click", () => {
      togglePhysics();
    });
    syncPhysicsToggle();
  }
  
  console.log("- Character physics system initialized (press toggle to enable)");
}

/**
 * Update character physics
 * Call this in the animation loop after updateCollisions()
 * @param {SparkScene} sparkScene
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateCharacterPhysics(sparkScene, deltaTime) {
  if (!physicsEnabled || !characterBody) return;
  
  // Check if grounded
  isGrounded = checkGrounded(sparkScene);
  
  // Get current velocity
  const velocity = characterBody.linvel();
  
  // Get movement input from controls
  // SparkControls uses WASD/arrows and stores movement in localFrame
  // We need to intercept the movement and apply it as physics forces instead
  
  // Get camera forward and right directions (horizontal only)
  const cameraWorldQuat = new THREE.Quaternion();
  sparkScene.camera.getWorldQuaternion(cameraWorldQuat);
  
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyQuaternion(cameraWorldQuat);
  forward.y = 0;
  forward.normalize();
  
  const right = new THREE.Vector3(1, 0, 0);
  right.applyQuaternion(cameraWorldQuat);
  right.y = 0;
  right.normalize();
  
  // Check keyboard input directly for movement
  const moveSpeed = sparkScene.controls.fpsMovement.moveSpeed || 5.0;
  let moveX = 0;
  let moveZ = 0;
  
  // Read keyboard state
  if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) moveZ += 1;
  if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) moveZ -= 1;
  if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) moveX -= 1;
  if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) moveX += 1;
  
  // Calculate desired velocity
  const desiredVel = new THREE.Vector3();
  desiredVel.addScaledVector(forward, moveZ * moveSpeed);
  desiredVel.addScaledVector(right, moveX * moveSpeed);
  
  // Apply movement (preserve vertical velocity for gravity/jumping)
  characterBody.setLinvel(
    { x: desiredVel.x, y: velocity.y, z: desiredVel.z },
    true
  );
  
  // Update camera/localFrame position to follow character
  const translation = characterBody.translation();
  
  // Position the localFrame so camera is at character's eye level
  // Camera is at localFrame position, so we offset by eye height
  const eyeHeight = CHARACTER_CONFIG.height * 0.9; // Eyes at 90% of height
  const halfHeight = (CHARACTER_CONFIG.height - 2 * CHARACTER_CONFIG.radius) / 2;
  const characterBottom = translation.y - halfHeight - CHARACTER_CONFIG.radius;
  
  sparkScene.localFrame.position.set(
    translation.x,
    characterBottom + eyeHeight,
    translation.z
  );
}

// Track pressed keys for movement
const keysPressed = new Set();

// Setup key tracking
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    keysPressed.add(e.code);
  });
  
  window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.code);
  });
  
  // Clear keys when window loses focus
  window.addEventListener('blur', () => {
    keysPressed.clear();
  });
}

