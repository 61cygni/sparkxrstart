import * as THREE from "three";
import { checkAssets } from "./assets.js";
import { createAttachedAudio } from "./spatial-audio.js";

// Import FBXLoader from CDN (matches three.js version)
const { FBXLoader } = await import("https://cdn.jsdelivr.net/npm/three@0.179.0/examples/jsm/loaders/FBXLoader.js");

let robot = null;
let waypoints = [];
let movementSpeed = 2.0; // units per second

/**
 * Remove embedded lights from a loaded model
 * FBX files often contain lights from the 3D software used to create them
 * @param {THREE.Object3D} object - The loaded model
 */
function removeEmbeddedLights(object) {
  const lightsToRemove = [];
  
  object.traverse((child) => {
    if (child.isLight) {
      console.log(`⚠️ Found embedded light in robot: ${child.type} "${child.name || 'unnamed'}" at position [${child.position.toArray().join(', ')}], intensity: ${child.intensity}`);
      lightsToRemove.push(child);
    }
  });
  
  // Remove embedded lights
  lightsToRemove.forEach((light) => {
    if (light.parent) {
      light.parent.remove(light);
      console.log(`  → Removed embedded light from robot: ${light.type}`);
    }
  });
  
  return lightsToRemove.length;
}
let pauseDuration = 1000; // Pause duration in ms
let rotationDuration = 1500; // Rotation duration in ms

// State machine for robot movement
let robotState = {
  phase: 'paused', // 'moving', 'paused', 'rotating'
  currentWaypointIndex: 0,
  phaseStartTime: 0,
  startPosition: new THREE.Vector3(),
  targetPosition: new THREE.Vector3(),
  startRotation: 0,
  targetRotation: 0
};

/**
 * Calculate rotation angle to face a target position
 * @param {THREE.Vector3} from - Current position
 * @param {THREE.Vector3} to - Target position
 * @returns {number} - Rotation angle in radians around Y axis
 */
function calculateRotationToTarget(from, to) {
  const direction = new THREE.Vector3();
  direction.subVectors(to, from);
  direction.y = 0; // Only rotate on horizontal plane
  return Math.atan2(direction.x, direction.z);
}

/**
 * Initialize and load the robot model
 * @param {SparkScene} sparkScene - The spark scene to add the robot to
 * @param {string} configFile - Path to robot config JSON file
 * @param {function} assetUrlFn - Function to resolve asset URLs
 * @returns {Promise<THREE.Group>} - The loaded robot model
 */
export async function initializeRobot(sparkScene, configFile = 'robot-config.json', assetUrlFn = checkAssets) {
  // Load robot config
  try {
    const configUrl = await assetUrlFn(configFile);
    const response = await fetch(configUrl);
    const config = await response.json();
    
    waypoints = config.waypoints.map(wp => new THREE.Vector3(wp[0], wp[1], wp[2]));
    movementSpeed = config.movementSpeed || 2.0;
    pauseDuration = config.pauseDuration || 1000;
    rotationDuration = config.rotationDuration || 1500;
    
    console.log(`Loaded ${waypoints.length} waypoints for robot`);
  } catch (error) {
    console.error("Failed to load robot config:", error);
    // Fallback to default waypoint
    waypoints = [new THREE.Vector3(-0.75, 6.9, -12.7)];
  }
  
  const loader = new FBXLoader();
  const robotURL = await assetUrlFn('robot.fbx');
  
  return new Promise((resolve, reject) => {
    loader.load(
      robotURL,
      (fbx) => {
        robot = fbx;
        
        // Remove any embedded lights from the FBX file
        const removedCount = removeEmbeddedLights(fbx);
        if (removedCount > 0) {
          console.log(`Removed ${removedCount} embedded light(s) from robot.fbx`);
        }
        
        // Set initial position to first waypoint
        if (waypoints.length > 0) {
          robot.position.copy(waypoints[0]);
        } else {
          robot.position.set(-.75, 6.9, -12.7);
        }
        
        robot.scale.setScalar(0.01); // Scale down by 99%
        
        // Fix materials and log info
        console.log('Robot materials:');
        fbx.traverse((child) => {
          if (child.isMesh) {
            
            // Handle single or array of materials
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach((mat, i) => {
              
              // Log texture info
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
              }
              if (mat.normalMap) console.log(`      - Has normal map`);
              if (mat.emissiveMap) {
                mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
              }
              
              // Ensure materials render both sides
              mat.side = THREE.DoubleSide;
              
              // Apply custom colors to make robot visible
              if (mat.name === 'body') {
                mat.color.setHex(0x3498db); // Blue body
              } else if (mat.name === 'eye') {
                mat.color.setHex(0x2ecc71); // Green eyes
                mat.emissive = new THREE.Color(0x2ecc71);
                mat.emissiveIntensity = 0.3;
              } else if (mat.name === 'eyeglasses') {
                mat.color.setHex(0x2c3e50); // Dark glasses
              }
            });
          }
        });
        
        sparkScene.scene.add(robot);
        
        // Initialize robot state - start paused at first waypoint
        robotState.phase = 'paused';
        robotState.currentWaypointIndex = 0;
        robotState.phaseStartTime = performance.now();
        robotState.startPosition.copy(robot.position);
        robotState.targetPosition.copy(robot.position);
        
        // Calculate initial rotation to face next waypoint
        if (waypoints.length > 1) {
          robotState.targetRotation = calculateRotationToTarget(waypoints[0], waypoints[1]);
          robot.rotation.y = robotState.targetRotation;
        }
        
        // Add drone hum audio that follows the robot
        assetUrlFn('droid-hum.mp3').then(async (droneAudioUrl) => {
          try {
            await createAttachedAudio(droneAudioUrl, robot, {
              refDistance: 2,
              rolloffFactor: 1,
              maxDistance: 15,
              loop: true,
              volume: 0.3
            });
            console.log('Drone audio attached to robot');
          } catch (error) {
            console.warn('Failed to load drone audio:', error);
          }
        });
        
        console.log('Robot loaded and added to scene');
        resolve(robot);
      },
      (progress) => {
        if (progress.total) {
          console.log(`Loading robot: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        }
      },
      (error) => {
        console.error('Error loading robot:', error);
        reject(error);
      }
    );
  });
}

/**
 * Update robot position - navigates between waypoints with pause and rotation
 * @param {number} time - Current time in milliseconds
 */
export function updateRobot(time) {
  if (!robot || waypoints.length === 0) return;
  
  const phaseElapsed = time - robotState.phaseStartTime;
  
  // State machine transitions
  switch (robotState.phase) {
    case 'paused':
      // Stay at current waypoint
      robot.position.copy(robotState.startPosition);
      
      if (phaseElapsed >= pauseDuration) {
        // Check if there's a next waypoint
        const nextIndex = (robotState.currentWaypointIndex + 1) % waypoints.length;
        const nextWaypoint = waypoints[nextIndex];
        
        // Calculate rotation needed to face next waypoint
        robotState.startRotation = robot.rotation.y;
        robotState.targetRotation = calculateRotationToTarget(robot.position, nextWaypoint);
        
        // Only rotate if there's a significant angle difference
        const angleDiff = Math.abs(robotState.targetRotation - robotState.startRotation);
        const normalizedDiff = Math.min(angleDiff, Math.abs(angleDiff - Math.PI * 2));
        
        if (normalizedDiff > 0.1) {
          // Need to rotate
          robotState.phase = 'rotating';
          robotState.phaseStartTime = time;
        } else {
          // Skip rotation, go straight to moving
          robot.rotation.y = robotState.targetRotation;
          robotState.phase = 'moving';
          robotState.phaseStartTime = time;
          robotState.startPosition.copy(robot.position);
          robotState.targetPosition.copy(nextWaypoint);
        }
      }
      break;
      
    case 'rotating':
      // Rotate to face next waypoint
      const rotationProgress = Math.min(1, phaseElapsed / rotationDuration);
      const easedRotation = 0.5 - 0.5 * Math.cos(rotationProgress * Math.PI); // Smooth easing
      robot.position.copy(robotState.startPosition);
      robot.rotation.y = robotState.startRotation + (robotState.targetRotation - robotState.startRotation) * easedRotation;
      
      if (rotationProgress >= 1) {
        // Start moving to next waypoint
        robotState.phase = 'moving';
        robotState.phaseStartTime = time;
        const nextIndex = (robotState.currentWaypointIndex + 1) % waypoints.length;
        robotState.startPosition.copy(waypoints[robotState.currentWaypointIndex]);
        robotState.targetPosition.copy(waypoints[nextIndex]);
      }
      break;
      
    case 'moving':
      // Move towards target waypoint
      const distance = robotState.startPosition.distanceTo(robotState.targetPosition);
      const travelTime = (distance / movementSpeed) * 1000; // Convert to ms
      const moveProgress = Math.min(1, phaseElapsed / travelTime);
      
      // Smooth interpolation
      const easedProgress = 0.5 - 0.5 * Math.cos(moveProgress * Math.PI);
      robot.position.lerpVectors(robotState.startPosition, robotState.targetPosition, easedProgress);
      
      // Keep facing direction of movement
      robot.rotation.y = robotState.targetRotation;
      
      if (moveProgress >= 1) {
        // Reached waypoint
        robot.position.copy(robotState.targetPosition);
        robotState.currentWaypointIndex = (robotState.currentWaypointIndex + 1) % waypoints.length;
        robotState.startPosition.copy(robot.position);
        robotState.phase = 'paused';
        robotState.phaseStartTime = time;
      }
      break;
  }
}

/**
 * Get the robot model
 * @returns {THREE.Group|null} - The robot model or null if not loaded
 */
export function getRobot() {
  return robot;
}

