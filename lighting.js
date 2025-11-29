import * as THREE from "three";
import { isHudEnabled, onHudToggle } from "./hud.js";

const lights = [];
const lightDebugMeshes = [];

/**
 * Create a debug mesh for visualizing a light
 * @param {THREE.Light} light - The light to visualize
 * @param {string} type - Type of light
 * @param {THREE.Vector3} position - Position of the light
 * @returns {THREE.Mesh} - Debug mesh
 */
function createLightDebugMesh(light, type, position) {
  let color = 0xffff00; // Default yellow
  let size = 0.5; // Larger size for visibility
  
  // Different colors and sizes for different light types
  switch (type) {
    case 'directional':
      color = 0x00ffff; // Cyan
      size = 0.4;
      break;
    case 'point':
      color = 0xffff00; // Yellow
      size = 0.5;
      break;
    case 'spot':
      color = 0xff00ff; // Magenta
      size = 0.5;
      break;
    case 'hemisphere':
      color = 0x00ff00; // Green
      size = 0.4;
      break;
  }
  
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 16),
    new THREE.MeshBasicMaterial({ color: color, wireframe: true })
  );
  mesh.position.copy(position);
  mesh.visible = isHudEnabled();
  
  return mesh;
}

/**
 * Create a light from config
 * @param {object} config - Light configuration
 * @returns {THREE.Light} - The created light
 */
function createLight(config) {
  const { type, color = 0xffffff, intensity = 1, position, target } = config;
  
  let light;
  const lightColor = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
  
  switch (type) {
    case 'ambient':
      light = new THREE.AmbientLight(lightColor, intensity);
      break;
      
    case 'directional':
      light = new THREE.DirectionalLight(lightColor, intensity);
      if (position) {
        light.position.set(position[0], position[1], position[2]);
      }
      if (target) {
        light.target.position.set(target[0], target[1], target[2]);
      }
      // Shadow settings
      if (config.castShadow) {
        light.castShadow = true;
        light.shadow.mapSize.width = config.shadowMapSize || 1024;
        light.shadow.mapSize.height = config.shadowMapSize || 1024;
      }
      break;
      
    case 'point':
      light = new THREE.PointLight(lightColor, intensity, config.distance || 0, config.decay || 2);
      if (position) {
        light.position.set(position[0], position[1], position[2]);
      }
      if (config.castShadow) {
        light.castShadow = true;
      }
      break;
      
    case 'spot':
      light = new THREE.SpotLight(
        lightColor,
        intensity,
        config.distance || 0,
        config.angle || Math.PI / 3,
        config.penumbra || 0,
        config.decay || 2
      );
      if (position) {
        light.position.set(position[0], position[1], position[2]);
      }
      if (target) {
        light.target.position.set(target[0], target[1], target[2]);
      }
      if (config.castShadow) {
        light.castShadow = true;
      }
      break;
      
    case 'hemisphere':
      const groundColor = typeof config.groundColor === 'string' 
        ? parseInt(config.groundColor.replace('#', ''), 16) 
        : (config.groundColor || 0x444444);
      light = new THREE.HemisphereLight(lightColor, groundColor, intensity);
      if (position) {
        light.position.set(position[0], position[1], position[2]);
      }
      break;
      
    default:
      console.warn(`Unknown light type: ${type}`);
      return null;
  }
  
  if (light && config.name) {
    light.name = config.name;
  }
  
  return light;
}

/**
 * Initialize lighting from a config file
 * @param {SparkScene} sparkScene - The spark scene to add lights to
 * @param {string} configFile - Path to the lighting config JSON file
 * @param {function} assetUrlFn - Function to resolve asset URLs
 */
export async function initializeLighting(sparkScene, configFile, assetUrlFn) {
  let lightConfigs = [];
  
  try {
    const configUrl = await assetUrlFn(configFile);
    const response = await fetch(configUrl);
    lightConfigs = await response.json();
    console.log(`Loaded ${lightConfigs.length} light configuration(s)`);
  } catch (error) {
    console.error("Failed to load lighting configuration:", error);
    return;
  }
  
  for (const config of lightConfigs) {
    const light = createLight(config);
    if (light) {
      sparkScene.scene.add(light);
      lights.push(light);
      
      // For directional and spot lights, add target to scene
      if (light.target) {
        sparkScene.scene.add(light.target);
      }
      
      // Create debug mesh for lights with positions (skip ambient lights)
      if (config.type !== 'ambient') {
        let position;
        if (config.position) {
          position = new THREE.Vector3(config.position[0], config.position[1], config.position[2]);
        } else if (light.position) {
          // Use light's position if set but not in config
          position = light.position.clone();
        }
        
        if (position) {
          const debugMesh = createLightDebugMesh(light, config.type, position);
          sparkScene.scene.add(debugMesh);
          lightDebugMeshes.push(debugMesh);
          console.log(`Created debug mesh for ${config.name} at position:`, position);
        }
      }
      
      console.log(`Added ${config.type} light: ${config.name || 'unnamed'}`);
    }
  }
  
  // Register for HUD toggle events to show/hide debug meshes
  onHudToggle(setLightDebugVisibility);
  
  // Sync initial visibility state
  setLightDebugVisibility(isHudEnabled());
}

/**
 * Update debug mesh visibility based on HUD state
 * @param {boolean} visible - Whether HUD is visible
 */
function setLightDebugVisibility(visible) {
  console.log(`Setting light debug visibility to ${visible}, meshes: ${lightDebugMeshes.length}`);
  for (const mesh of lightDebugMeshes) {
    mesh.visible = visible;
  }
}

/**
 * Get all lights
 * @returns {THREE.Light[]} - Array of all lights
 */
export function getLights() {
  return lights;
}

/**
 * Get a light by name
 * @param {string} name - The light name
 * @returns {THREE.Light|null} - The light or null if not found
 */
export function getLightByName(name) {
  return lights.find(light => light.name === name) || null;
}

