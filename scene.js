import * as THREE from "three";
import { NewSparkRenderer, SplatMesh, SparkControls, VRButton, XrHands } from "@sparkjsdev/spark";


/**
 *  Primary datascructure for all the scene state
 * 
 */

export class SparkScene {
  constructor() {
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.localFrame = null;
    this.spark = null;
    this.gsplatscene = null;
    this.collisionmesh = null;
    this.physicsWorld = null;
    this.collisionMeshes = [];
    this.dynamicObjects = new Map();
    this.controls = null;
    this.xrHands = null;
  }
}

/**
 * Fetch a file with progress tracking
 * @param {string} url - URL to fetch
 * @param {function} onProgress - Callback (progress, loadedBytes, totalBytes)
 * @returns {Promise<ArrayBuffer>} - File bytes
 */
async function fetchWithProgress(url, onProgress) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
  
  const reader = response.body.getReader();
  const chunks = [];
  let loadedBytes = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    loadedBytes += value.length;
    
    if (onProgress) {
      const progress = totalBytes ? loadedBytes / totalBytes : loadedBytes / (loadedBytes + 10 * 1024 * 1024);
      onProgress(progress, loadedBytes, totalBytes);
    }
  }
  
  // Combine chunks into single ArrayBuffer
  const result = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result.buffer;
}

/**
 * Create a Spark scene with gaussian splat background
 * @param {string} backgroundURL - URL to the SPZ file
 * @param {object} options - Options
 * @param {function} options.onProgress - Progress callback (progress, loadedBytes, totalBytes)
 * @param {object} renderConfig - Render configuration
 * @param {number} renderConfig.maxStdDev - Maximum standard deviation for splat rendering
 * @param {number} renderConfig.lodSplatScale - LOD splat scale factor
 * @returns {Promise<SparkScene>}
 */
export async function createSparkScene(backgroundURL, options = {}, renderConfig = {}) {
  const { onProgress } = options;
  const {
    maxStdDev = Math.sqrt(5),
    lodSplatScale = 2.0,
  } = renderConfig;
  
  const sparkScene = new SparkScene();
  
  // Renderer setup
  sparkScene.renderer = new THREE.WebGLRenderer();
  sparkScene.renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(sparkScene.renderer.domElement);
  
  // Scene setup
  sparkScene.scene = new THREE.Scene();
  sparkScene.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // Local frame for camera control and WebXR reference
  sparkScene.localFrame = new THREE.Group();
  sparkScene.scene.add(sparkScene.localFrame);
  
  sparkScene.spark = new NewSparkRenderer({
    renderer: sparkScene.renderer,
    maxStdDev: maxStdDev,
    lodSplatScale: lodSplatScale,
  });
  sparkScene.scene.add(sparkScene.spark);
  sparkScene.localFrame.add(sparkScene.camera);
  
  // Load main scene with progress tracking
  console.log('splatURL', backgroundURL);
  
  let splatOptions = { lod: false, nonLod: true };
  
  if (onProgress) {
    // Fetch with progress tracking, then pass bytes to SplatMesh
    const fileBytes = await fetchWithProgress(backgroundURL, onProgress);
    splatOptions.fileBytes = fileBytes;
  } else {
    // Direct URL loading (no progress)
    splatOptions.url = backgroundURL;
  }
  
  sparkScene.gsplatscene = new SplatMesh(splatOptions);
  sparkScene.gsplatscene.position.set(0, 0, 0);
  sparkScene.scene.add(sparkScene.gsplatscene);
  
  
  // Window resize handler
  window.addEventListener('resize', onWindowResize, false);
  function onWindowResize() {
    sparkScene.camera.aspect = window.innerWidth / window.innerHeight;
    sparkScene.camera.updateProjectionMatrix();
    sparkScene.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Controls setup
  sparkScene.controls = new SparkControls({ canvas: sparkScene.renderer.domElement });
  
  return sparkScene;
}

/**
 * Initialize VR support for the scene
 * @param {SparkScene} sparkScene - The spark scene
 * @param {object} options - Options
 * @param {object} renderConfig - Render configuration
 * @param {number} renderConfig.xrFramebufferScaleFactor - XR framebuffer scale factor (default: 0.5)
 */
export function initializeVR(sparkScene, options = {}, renderConfig = {}) {
  const {
    xrFramebufferScaleFactor = 0.5,
  } = renderConfig;
  
  // WebXR setup
  const vrButton = VRButton.createButton(sparkScene.renderer, {
    optionalFeatures: ["hand-tracking"],
  });
  
  if (vrButton) {
    document.body.appendChild(vrButton);
    
    const xrHands = new XrHands();
    sparkScene.xrHands = xrHands;
    const handMesh = xrHands.makeGhostMesh();
    handMesh.editable = false;
    sparkScene.localFrame.add(handMesh);
  }

  // Redo controls to include VR 
  sparkScene.controls = new SparkControls({ canvas: sparkScene.renderer.domElement });

  // Setup controls
  sparkScene.controls.fpsMovement.xr = sparkScene.renderer.xr;
  // reduces resolution. But you can't really tell with splats so this is a free performance boost.
  sparkScene.renderer.xr.setFramebufferScaleFactor(xrFramebufferScaleFactor);
}

export function startAnimationLoop(sparkScene, animLoopHook) {
  const CAMERA_DISCONTINUITY_THRESHOLD = 0.5;
  let lastCameraPos = new THREE.Vector3(0, 0, 0);

  sparkScene.renderer.setAnimationLoop(function animate(time, xrFrame) {
    // Local frame compensation for WebXR (Quest 3 and Vision Pro)
    if (lastCameraPos.distanceTo(sparkScene.camera.position) > CAMERA_DISCONTINUITY_THRESHOLD) {
      sparkScene.localFrame.position.copy(sparkScene.camera.position).multiplyScalar(-1);
    }
    lastCameraPos.copy(sparkScene.camera.position);

    // Call HUD update callback if provided
    animLoopHook(sparkScene, time);


    sparkScene.controls.update(sparkScene.localFrame);
    // Update WebXR hands if active
    if (sparkScene.renderer.xr.isPresenting && sparkScene.xrHands) {
        sparkScene.xrHands.update({ xr: sparkScene.renderer.xr, xrFrame });
    }

    sparkScene.renderer.render(sparkScene.scene, sparkScene.camera);
  });
}
