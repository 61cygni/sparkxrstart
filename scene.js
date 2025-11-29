import * as THREE from "three";
import { NewSparkRenderer, SplatMesh, SparkControls, VRButton, XrHands } from "@sparkjsdev/spark";
import { RENDER_CONFIG } from "./config.js";

export class SparkScene {
  constructor() {
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.localFrame = null;
    this.spark = null;
    this.background = null;
    this.controls = null;
    this.xrHands = null;
  }
}

export async function createSparkScene(backgroundURL) {
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
    maxStdDev: RENDER_CONFIG.maxStdDev,
    lodSplatScale: RENDER_CONFIG.lodSplatScale,
  });
  sparkScene.scene.add(sparkScene.spark);
  sparkScene.localFrame.add(sparkScene.camera);
  
  // Load main scene 
  console.log('splatURL', backgroundURL);
  sparkScene.background = new SplatMesh({ url: backgroundURL, lod: true, nonLod: true });
  sparkScene.background.position.set(0, 0, 0);
  sparkScene.scene.add(sparkScene.background);
  
  
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

export function initializeVR(sparkScene, options = {}) {
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
  sparkScene.renderer.xr.setFramebufferScaleFactor(RENDER_CONFIG.xrFramebufferScaleFactor);
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
