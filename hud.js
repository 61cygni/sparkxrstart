// HUD data structure
export class HUDData {
  constructor() {
    this.xpos = 0;
    this.ypos = 0;
    this.zpos = 0;
    this.fps = 0;
  }
}

let hudElement = null;
let hudVisible = false;
const hudData = new HUDData();

// FPS tracking variables
const FPS_UPDATE_INTERVAL = 500;
let lastTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = performance.now();

// Sync HUD toggle button icon
function syncHUDToggle() {
  const hudToggleButton = document.getElementById("hud-toggle");
  if (!hudToggleButton) return;
  hudToggleButton.innerHTML = hudVisible ? '<i data-lucide="panel-top"></i>' : '<i data-lucide="eye-off"></i>';
  hudToggleButton.setAttribute("aria-label", hudVisible ? "Hide HUD" : "Show HUD");
  // Re-initialize icons after dynamically setting innerHTML
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Initialize HUD element
export function initializeHUD() {
  // Check if HUD element already exists
  hudElement = document.getElementById('hud');
  
  if (!hudElement) {
    // Create HUD element if it doesn't exist
    hudElement = document.createElement('div');
    hudElement.id = 'hud';
    hudElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #0f0;
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      line-height: 1.6;
      z-index: 1000;
      pointer-events: none;
      min-width: 200px;
      font-family: monospace;
      display: none;
    `;
    document.body.appendChild(hudElement);
  } else {
    // Ensure existing HUD element respects visibility state
    hudElement.style.display = hudVisible ? 'block' : 'none';
  }
  
  // Initialize FPS tracking
  lastTime = performance.now();
  frameCount = 0;
  lastFpsUpdate = performance.now();
  
  // Setup HUD toggle button
  const hudToggleButton = document.getElementById("hud-toggle");
  if (hudToggleButton) {
    hudToggleButton.addEventListener("click", () => {
      toggleHUD();
    });
    syncHUDToggle();
  }
  
  updateHUD();
}

// Update HUD display with camera position and FPS
export function updateHUD(cameraPosition) {
  if (!hudElement) return;
  if (!hudVisible) return;
  
  const currentTime = performance.now();
  frameCount++;
  
  // Update FPS
  if (currentTime - lastFpsUpdate >= FPS_UPDATE_INTERVAL) {
    hudData.fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = currentTime;
  }
  
  // Update position if camera position is provided
  if (cameraPosition) {
    hudData.xpos = cameraPosition.x;
    hudData.ypos = cameraPosition.y;
    hudData.zpos = cameraPosition.z;
  }
  
  hudElement.innerHTML = `
    <div><span style="color: #0ff;">X:</span> <span style="color: #0f0;">${hudData.xpos.toFixed(2)}</span></div>
    <div><span style="color: #0ff;">Y:</span> <span style="color: #0f0;">${hudData.ypos.toFixed(2)}</span></div>
    <div><span style="color: #0ff;">Z:</span> <span style="color: #0f0;">${hudData.zpos.toFixed(2)}</span></div>
    <div><span style="color: #0ff;">FPS:</span> <span style="color: #0f0;">${hudData.fps}</span></div>
  `;
}

// Toggle HUD visibility
export function toggleHUD() {
  hudVisible = !hudVisible;
  if (hudElement) {
    hudElement.style.display = hudVisible ? 'block' : 'none';
  }
  syncHUDToggle();
}

// Get HUD data object for updating values
export function getHUDData() {
  return hudData;
}

