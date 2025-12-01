import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";

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
        console.log(`⚽ Kicked "${name}" with force ${force.toFixed(2)} (distance: ${distance.toFixed(2)}m)`);
      }
    }
  });
  
  if (kickedCount > 0) {
    console.log(`✓ Kicked ${kickedCount} dynamic object(s)`);
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
        console.log(`🏀 Threw "${name}" with force ${force.toFixed(2)} (distance: ${distance.toFixed(2)}m)`);
      }
    }
  });
  
  if (thrownCount > 0) {
    console.log(`✓ Threw ${thrownCount} dynamic object(s)`);
  } else {
    console.log(`No objects within throw distance (${throwDistance}m)`);
  }
}

