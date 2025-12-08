import * as THREE from "three";
import { SplatEdit, SplatEditRgbaBlendMode, SplatEditSdf, SplatEditSdfType } from "@sparkjsdev/spark";

// Store path waypoints
const pathWaypoints = [];
let sparkSceneRef = null;
let pathVisible = true;
let pathSplatEdit = null;

/**
 * Initialize path system by loading path-config.json
 * @param {SparkScene} sparkScene - The spark scene
 * @param {string} configURL - URL to path-config.json
 * @param {function} assetUrlFn - Asset resolver function
 */
export async function initializePath(sparkScene, configURL, assetUrlFn) {
  sparkSceneRef = sparkScene;
  
  // Create SplatEdit layer for ground highlight SDFs (in scene space, not localFrame)
  pathSplatEdit = new SplatEdit({
    rgbaBlendMode: SplatEditRgbaBlendMode.ADD_RGBA,
    sdfSmooth: 0.05,
    softEdge: 0.1,
  });
  sparkScene.scene.add(pathSplatEdit);
  
  try {
    const pathConfigUrl = await assetUrlFn(configURL);
    const response = await fetch(pathConfigUrl);
    const pathConfig = await response.json();
    
    // Handle both array format and object with waypoints array
    const waypoints = Array.isArray(pathConfig) 
      ? pathConfig 
      : (pathConfig.waypoints || []);
    
    console.log(`Loaded ${waypoints.length} path waypoint(s)`);
    
    // Create floating spheres for each waypoint
    waypoints.forEach((waypoint, index) => {
      const position = new THREE.Vector3(
        waypoint.position[0],
        waypoint.position[1],
        waypoint.position[2]
      );
      
      const triggerRadius = waypoint.triggerRadius || 2.0;
      const color = waypoint.color ? new THREE.Color(waypoint.color) : new THREE.Color(0x00ff00);
      const radius = waypoint.radius || 0.3;
      
      // Create sphere geometry
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.5
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(position);
      
      // Add to scene
      sparkScene.scene.add(sphere);
      
      // Create SDF sphere below the path sphere to highlight the ground
      const highlightSdf = new SplatEditSdf({
        type: SplatEditSdfType.SPHERE,
        radius: 0.6, // Larger radius for ground highlight
        color: color,
        opacity: 0.10, // Subtle highlight
      });
      
      // Position highlight below the floating sphere (configurable per waypoint)
      const highlightOffset = waypoint.highlightOffset ?? 1.2; // Distance below the sphere
      highlightSdf.position.set(position.x, position.y - highlightOffset, position.z);
      
      // Add SDF to the SplatEdit layer
      pathSplatEdit.add(highlightSdf);
      
      // Store waypoint info
      pathWaypoints.push({
        sphere: sphere,
        highlightSdf: highlightSdf,
        position: position,
        triggerRadius: triggerRadius,
        triggered: false,
        baseY: position.y,
        highlightOffset: highlightOffset,
        index: index
      });
      
      console.log(`Created path waypoint ${index + 1} at [${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}] with trigger radius ${triggerRadius}`);
    });
    
    if (pathWaypoints.length > 0) {
      console.log(`- Path system initialized with ${pathWaypoints.length} waypoint(s)`);
      // Setup toggle button after waypoints are created
      setupPathToggleButton();
      // Initial sync to show count
      syncPathToggle();
    }
  } catch (error) {
    console.warn("Failed to load path configuration:", error);
  }
}

/**
 * Update path waypoints - check proximity and animate floating spheres
 * @param {THREE.Vector3} playerPosition - Current player position
 * @param {number} time - Current time in milliseconds (for animation)
 */
export function updatePath(playerPosition, time) {
  if (!sparkSceneRef || pathWaypoints.length === 0 || !pathVisible) return;
  
  pathWaypoints.forEach((waypoint) => {
    if (waypoint.triggered) return; // Skip already triggered waypoints
    
    // Calculate distance from player to waypoint
    const distance = playerPosition.distanceTo(waypoint.position);
    
    // Check if player is within trigger radius
    if (distance <= waypoint.triggerRadius) {
      // Hide the sphere and remove the SDF highlight
      waypoint.sphere.visible = false;
      if (pathSplatEdit && waypoint.highlightSdf) {
        pathSplatEdit.remove(waypoint.highlightSdf);
      }
      waypoint.triggered = true;
      console.log(`Path waypoint ${waypoint.index + 1} triggered at distance ${distance.toFixed(2)}m`);
      // Update button count when a waypoint is triggered
      syncPathToggle();
    } else {
      // Animate floating effect (gentle up and down motion)
      const floatAmount = 0.2; // How much the sphere floats up and down
      const floatSpeed = 0.001; // Speed of floating animation
      const offset = Math.sin(time * floatSpeed) * floatAmount;
      const newY = waypoint.baseY + offset;
      
      waypoint.sphere.position.y = newY;
      
      // Animate the SDF highlight to oscillate with the sphere
      if (waypoint.highlightSdf) {
        waypoint.highlightSdf.position.set(
          waypoint.position.x,
          newY - waypoint.highlightOffset,
          waypoint.position.z
        );
      }
    }
  });
}

/**
 * Reset all path waypoints (make them visible again)
 */
export function resetPath() {
  pathWaypoints.forEach((waypoint) => {
    waypoint.sphere.visible = pathVisible;
    waypoint.triggered = false;
    // Re-add SDF highlight if path is visible
    if (pathVisible && waypoint.highlightSdf && pathSplatEdit) {
      pathSplatEdit.add(waypoint.highlightSdf);
    }
  });
  console.log("Path waypoints reset");
}

/**
 * Get the number of remaining (untriggered) waypoints
 * @returns {number}
 */
export function getRemainingWaypoints() {
  return pathWaypoints.filter(wp => !wp.triggered).length;
}

/**
 * Toggle path visibility on/off
 */
export function togglePath() {
  pathVisible = !pathVisible;
  
  pathWaypoints.forEach((waypoint) => {
    if (!waypoint.triggered) {
      waypoint.sphere.visible = pathVisible;
      // Toggle SDF highlight visibility
      if (waypoint.highlightSdf && pathSplatEdit) {
        if (pathVisible) {
          pathSplatEdit.add(waypoint.highlightSdf);
        } else {
          pathSplatEdit.remove(waypoint.highlightSdf);
        }
      }
    }
  });
  
  syncPathToggle();
  console.log(pathVisible ? "- Path waypoints shown" : "- Path waypoints hidden");
}

/**
 * Check if path is visible
 * @returns {boolean}
 */
export function isPathVisible() {
  return pathVisible;
}

/**
 * Sync path toggle button icon and count
 */
function syncPathToggle() {
  const button = document.getElementById("path-toggle");
  if (!button) return;
  
  const remainingCount = getRemainingWaypoints();
  const countText = pathVisible && remainingCount > 0 ? `<span class="path-count">${remainingCount}</span>` : '';
  
  // Use map-pin icon when visible, map-pin-off when hidden
  button.innerHTML = pathVisible 
    ? `<i data-lucide="map-pin"></i>${countText}` 
    : '<i data-lucide="map-pin-off"></i>';
  
  const ariaLabel = pathVisible 
    ? `Hide path waypoints (${remainingCount} remaining)` 
    : "Show path waypoints";
  button.setAttribute("aria-label", ariaLabel);
  
  // Re-initialize icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Setup path toggle button
 */
function setupPathToggleButton() {
  const button = document.getElementById("path-toggle");
  if (button) {
    button.addEventListener("click", () => {
      togglePath();
    });
    syncPathToggle();
  }
}

