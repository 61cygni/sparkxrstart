import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { checkAssets } from "./assets.js";
import { onHudToggle, isHudEnabled } from "./hud.js";

// Import GLTFLoader from CDN (matches three.js version)
const { GLTFLoader } = await import("https://cdn.jsdelivr.net/npm/three@0.179.0/examples/jsm/loaders/GLTFLoader.js");

const gltfLoader = new GLTFLoader();
let sparkSceneRef = null; // Reference to sparkScene for HUD toggle callback

/**
 * Initialize Rapier physics world
 * @returns {Promise<RAPIER.World>} - The physics world
 */
async function initPhysicsWorld() {
  // Initialize Rapier
  await RAPIER.init();
  
  // Create physics world with gravity
  const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
  const world = new RAPIER.World(gravity);
  
  console.log("✓ Rapier physics world initialized");
  return world;
}

/**
 * Create collision bodies from mesh geometry
 * @param {SparkScene} sparkScene - The spark scene
 * @param {THREE.Mesh} mesh - The mesh to create collision bodies from
 * @param {RAPIER.World} world - The physics world
 * @param {THREE.Vector3} position - Optional position offset
 * @param {THREE.Quaternion} rotation - Optional rotation
 */
function createCollisionFromMesh(sparkScene, mesh, world, position = null, rotation = null) {
  const geometry = mesh.geometry;
  
  if (!geometry) {
    console.warn("Mesh has no geometry, skipping collision creation");
    return;
  }
  
  // Get position and rotation
  const pos = position || mesh.position;
  const rot = rotation || mesh.quaternion;
  
  // Create collision body based on geometry type
  if (geometry.type === 'BufferGeometry') {
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    
    if (indices && indices.length > 0) {
      // Create trimesh collision for complex meshes
      const colliderDesc = RAPIER.ColliderDesc.trimesh(
        new Float32Array(vertices),
        new Uint32Array(indices)
      );
      
      // Set position and rotation
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
      
      const body = world.createRigidBody(bodyDesc);
      world.createCollider(colliderDesc, body);
      
      console.log(`- Created trimesh collision from mesh "${mesh.name || 'unnamed'}"`);
      sparkScene.collisionMeshes.push({ mesh, body, collider: null });
    } else {
      // For non-indexed geometry, create convex hull or box approximation
      console.warn(`Mesh "${mesh.name || 'unnamed'}" has no indices, using bounding box collision`);
      
      // Get bounding box
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      const colliderDesc = RAPIER.ColliderDesc.cuboid(
        size.x / 2,
        size.y / 2,
        size.z / 2
      );
      
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(
          pos.x + center.x,
          pos.y + center.y,
          pos.z + center.z
        )
        .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
      
      const body = world.createRigidBody(bodyDesc);
      world.createCollider(colliderDesc, body);
      
      console.log(`- Created box collision from mesh "${mesh.name || 'unnamed'}"`);
      sparkScene.collisionMeshes.push({ mesh, body, collider: null });
    }
  }
}

/**
 * Load collision mesh and create physics bodies
 * @param {SparkScene} sparkScene - The spark scene
 * @param {string} meshPath - Path to the collision mesh GLB file
 * @param {function} assetUrlFn - Function to resolve asset URLs
 */
export async function initializeCollisions(sparkScene, meshPath, assetUrlFn = checkAssets) {
  // Initialize physics world
  sparkScene.physicsWorld = await initPhysicsWorld();
  
  // Load collision mesh
  const meshURL = await assetUrlFn(meshPath);
  
  console.log(`Loading collision mesh from: ${meshURL}`);

  return new Promise((resolve, reject) => {
    // Load the GLB directly without setting path (GLB is self-contained)
    gltfLoader.load(
      meshURL,
      (gltf) => {
        const scene = gltf.scene;
        sparkScene.collisionmesh = scene; // Store in SparkScene
        sparkSceneRef = sparkScene; // Store reference for HUD toggle callback
        
        // Initially hide the collision mesh (will be shown when HUD is enabled)
        scene.visible = false;
        sparkScene.scene.add(scene);
        
        // Register for HUD toggle to show/hide collision mesh
        onHudToggle(updateCollisionMeshVisibility);
        
        // Set initial visibility state
        updateCollisionMeshVisibility(isHudEnabled());
        
        console.log(`✓ Loaded collision mesh: ${meshPath}`);
        
        // Note: Physics bodies will be created after rotation is applied in main.js
        // Call createCollisionPhysicsBodies() after setting rotation
        
        resolve(sparkScene.physicsWorld);
      },
      (progress) => {
        if (progress.total) {
          console.log(`Loading collision mesh: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        }
      },
      (error) => {
        console.error(`Error loading collision mesh ${meshPath}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Update physics world (call this in your animation loop)
 * @param {SparkScene} sparkScene - The spark scene
 * @param {number} deltaTime - Time step in seconds
 */
export function updateCollisions(sparkScene, deltaTime) {
  if (sparkScene.physicsWorld) {
    sparkScene.physicsWorld.step();
  }
}

/**
 * Get all collision meshes
 * @param {SparkScene} sparkScene - The spark scene
 * @returns {Array} - Array of collision mesh objects
 */
export function getCollisionMeshes(sparkScene) {
  return sparkScene.collisionMeshes;
}

/**
 * Create a dynamic physics body for a ball/sphere object
 * @param {SparkScene} sparkScene - The spark scene
 * @param {THREE.Object3D} mesh - The mesh object
 * @param {string} name - Name of the object
 * @param {number} radius - Radius of the sphere collider
 * @param {THREE.Vector3} position - Initial position
 * @param {number} mass - Mass of the object (default: 1.0)
 * @param {number} restitution - Bounciness (0-1, default: 0.7)
 * @param {number} friction - Friction coefficient (default: 0.5)
 */
export function addDynamicObject(sparkScene, mesh, name, radius, position, mass = 1.0, restitution = 0.7, friction = 0.5) {
  if (!sparkScene.physicsWorld) {
    console.warn("Physics world not initialized, cannot add dynamic object");
    return null;
  }
  
  // Create dynamic rigid body
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z);
  
  const body = sparkScene.physicsWorld.createRigidBody(bodyDesc);
  
  // Create sphere collider
  const colliderDesc = RAPIER.ColliderDesc.ball(radius)
    .setMass(mass)
    .setRestitution(restitution)
    .setFriction(friction);
  
  const collider = sparkScene.physicsWorld.createCollider(colliderDesc, body);
  
  // Store reference
  sparkScene.dynamicObjects.set(name, { mesh, body, collider });
  
  console.log(`✓ Added dynamic physics body for "${name}" (radius: ${radius}, mass: ${mass})`);
  
  return { body, collider };
}

/**
 * Update visual mesh positions from physics bodies
 * Call this after updateCollisions() in your animation loop
 * @param {SparkScene} sparkScene - The spark scene
 */
export function updateDynamicObjects(sparkScene) {
  sparkScene.dynamicObjects.forEach(({ mesh, body }) => {
    if (mesh && body) {
      const translation = body.translation();
      const rotation = body.rotation();
      
      // Update mesh position
      mesh.position.set(translation.x, translation.y, translation.z);
      
      // Update mesh rotation
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  });
}

/**
 * Get a dynamic object by name
 * @param {SparkScene} sparkScene - The spark scene
 * @param {string} name - The object name
 * @returns {Object|null} - The dynamic object info or null if not found
 */
export function getDynamicObject(sparkScene, name) {
  return sparkScene.dynamicObjects.get(name) || null;
}

/**
 * Get all dynamic objects
 * @param {SparkScene} sparkScene - The spark scene
 * @returns {Map} - Map of all dynamic objects
 */
export function getAllDynamicObjects(sparkScene) {
  return sparkScene.dynamicObjects;
}

/**
 * Get the collision mesh scene for manual transforms
 * @param {SparkScene} sparkScene - The spark scene
 * @returns {THREE.Group|null} - The collision mesh scene or null if not loaded
 */
export function getCollisionMeshScene(sparkScene) {
  return sparkScene.collisionmesh;
}

/**
 * Create physics bodies from the collision mesh
 * Call this after the collision mesh has been rotated/positioned in main.js
 * @param {SparkScene} sparkScene - The spark scene
 */
export function createCollisionPhysicsBodies(sparkScene) {
  if (!sparkScene.physicsWorld || !sparkScene.collisionmesh) {
    console.warn("Cannot create physics bodies: physics world or collision mesh not initialized");
    return;
  }
  
  const scene = sparkScene.collisionmesh;
  
  // Update world matrices so child positions are in world space (accounts for rotation)
  scene.updateMatrixWorld(true);
  
  // Traverse the scene and create collision bodies for all meshes
  scene.traverse((child) => {
    if (child.isMesh) {
      // Get world position and quaternion (accounts for parent transforms including rotation)
      const worldPosition = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      child.getWorldPosition(worldPosition);
      child.getWorldQuaternion(worldQuaternion);
      
      createCollisionFromMesh(sparkScene, child, sparkScene.physicsWorld, worldPosition, worldQuaternion);
      
      // Set up wireframe material for visualization
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Green wireframe
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      
      // Store original material and set wireframe
      child.userData.originalMaterial = child.material;
      child.material = wireframeMaterial;
    }
  });
  
  console.log(`✓ Created ${sparkScene.collisionMeshes.length} collision body(ies)`);
}

/**
 * Update collision mesh visibility based on HUD state
 * @param {boolean} visible - Whether HUD is visible
 */
function updateCollisionMeshVisibility(visible) {
  if (sparkSceneRef && sparkSceneRef.collisionmesh) {
    sparkSceneRef.collisionmesh.visible = visible;
    console.log(`Collision mesh visibility: ${visible ? 'visible' : 'hidden'}`);
  }
}


