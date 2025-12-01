import * as THREE from "three";
import { checkAssets } from "./assets.js";
import { addDynamicObject } from "./collisions.js";

// Import loaders from CDN (matches three.js version)
const { FBXLoader } = await import("https://cdn.jsdelivr.net/npm/three@0.179.0/examples/jsm/loaders/FBXLoader.js");
const { GLTFLoader } = await import("https://cdn.jsdelivr.net/npm/three@0.179.0/examples/jsm/loaders/GLTFLoader.js");

const loadedObjects = new Map();
const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

/**
 * Remove embedded lights from a loaded model
 * FBX files often contain lights from the 3D software used to create them
 * @param {THREE.Object3D} object - The loaded model
 */
function removeEmbeddedLights(object) {
  const lightsToRemove = [];
  
  object.traverse((child) => {
    if (child.isLight) {
      console.log(`*️ Found embedded light in model: ${child.type} "${child.name || 'unnamed'}" at position [${child.position.toArray().join(', ')}], intensity: ${child.intensity}`);
      lightsToRemove.push(child);
    }
  });
  
  // Remove embedded lights
  lightsToRemove.forEach((light) => {
    if (light.parent) {
      light.parent.remove(light);
      console.log(`  → Removed embedded light: ${light.type}`);
    }
  });
  
  return lightsToRemove.length;
}

/**
 * Load a single mesh object (supports FBX, GLTF, and GLB formats)
 * @param {string} modelPath - Path to the model file
 * @returns {Promise<THREE.Group>} - The loaded mesh
 */
async function loadMeshObject(modelPath) {
  // Trim whitespace from the model path
  const trimmedPath = modelPath.trim();
  const modelURL = await checkAssets(trimmedPath);
  const modelDir = modelURL.substring(0, modelURL.lastIndexOf('/') + 1);
  
  // Detect file type from extension (trim whitespace)
  const extension = trimmedPath.toLowerCase().substring(trimmedPath.lastIndexOf('.') + 1).trim();
  
  if (extension === 'gltf' || extension === 'glb') {
    // Use GLTFLoader for GLTF/GLB files
    gltfLoader.setPath(modelDir);
    
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        modelURL,
        (gltf) => {
          // GLTFLoader returns an object with a 'scene' property
          const scene = gltf.scene;
          
          // Remove any embedded lights from the GLTF file
          const removedCount = removeEmbeddedLights(scene);
          if (removedCount > 0) {
            console.log(`Removed ${removedCount} embedded light(s) from ${trimmedPath}`);
          }
          
          console.log(`- Loaded GLTF: ${trimmedPath}`);
          resolve(scene);
        },
        (progress) => {
          if (progress.total) {
            console.log(`Loading ${trimmedPath}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
          }
        },
        (error) => {
          console.error(`Error loading ${trimmedPath}:`, error);
          reject(error);
        }
      );
    });
  } else if (extension === 'fbx') {
    // Use FBXLoader for FBX files
    fbxLoader.setResourcePath(modelDir);
    
    return new Promise((resolve, reject) => {
      fbxLoader.load(
        modelURL,
        (fbx) => {
          // Remove any embedded lights from the FBX file
          const removedCount = removeEmbeddedLights(fbx);
          if (removedCount > 0) {
            console.log(`Removed ${removedCount} embedded light(s) from ${trimmedPath}`);
          }
          resolve(fbx);
        },
        (progress) => {
          if (progress.total) {
            console.log(`Loading ${trimmedPath}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
          }
        },
        (error) => {
          console.error(`Error loading ${trimmedPath}:`, error);
          reject(error);
        }
      );
    });
  } else {
    throw new Error(`Unsupported file format: "${extension}". Supported formats: .fbx, .gltf, .glb`);
  }
}

/**
 * Initialize objects from a config file
 * @param {SparkScene} sparkScene - The spark scene to add objects to
 * @param {string} configFile - Path to the objects config JSON file
 * @param {function} assetUrlFn - Function to resolve asset URLs
 */
export async function initializeObjects(sparkScene, configFile = 'objects-config.json', assetUrlFn = checkAssets) {
  let objectConfigs = [];
  
  try {
    const configUrl = await assetUrlFn(configFile);
    const response = await fetch(configUrl);
    objectConfigs = await response.json();
    console.log(`Loaded ${objectConfigs.length} object configuration(s)`);
  } catch (error) {
    console.error("Failed to load objects configuration:", error);
    return;
  }
  
  for (const config of objectConfigs) {
    try {
      const { name, model, position, scale = 1.0 } = config;
      
      if (!name || !model || !position) {
        console.warn(`Skipping object config - missing required fields:`, config);
        continue;
      }
      
      // Load the mesh
      const mesh = await loadMeshObject(model);
      
      // Set position
      mesh.position.set(position[0], position[1], position[2]);
      
      // Set scale (can be a single number or [x, y, z] array)
      if (typeof scale === 'number') {
        mesh.scale.setScalar(scale);
      } else if (Array.isArray(scale)) {
        mesh.scale.set(scale[0], scale[1], scale[2]);
      }
      
      // Add to scene
      sparkScene.scene.add(mesh);
      
      // Store reference
      loadedObjects.set(name, mesh);
      
      // Add physics to all objects 
      // Calculate bounding sphere radius
      mesh.updateMatrixWorld();
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const radius = Math.max(size.x, size.y, size.z) / 2;
      
      // Add physics body with bouncy properties
      addDynamicObject(
        sparkScene,
        mesh,
        name,
        radius,
        new THREE.Vector3(position[0], position[1], position[2]),
        1.0,  // mass
        0.8,  // restitution (bounciness)
        0.3   // friction
      );
      
      console.log(`Added object "${name}" at position [${position[0]}, ${position[1]}, ${position[2]}]`);
    } catch (error) {
      console.error(`Failed to load object "${config.name || 'unnamed'}":`, error);
    }
  }
}

/**
 * Get an object by name
 * @param {string} name - The object name
 * @returns {THREE.Group|null} - The object or null if not found
 */
export function getObject(name) {
  return loadedObjects.get(name) || null;
}

/**
 * Get all loaded objects
 * @returns {Map<string, THREE.Group>} - Map of all loaded objects
 */
export function getAllObjects() {
  return loadedObjects;
}
