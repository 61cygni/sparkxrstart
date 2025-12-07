// Configuration file for cozyship scene

// Asset paths
// Asset lookup will first check localPath (vite defaults to public/) Then will
// check the cdn URL. 
export const ASSETS_CONFIG = {
  localPath: '/scenes/cozyship/assets/',
  cdnBaseUrl: 'https://public-spz.t3.storage.dev'
};

// Audio settings
export const AUDIO_CONIFG = {
  // Background music file name
  // backgroundMusicFileName: 'background.mp3',
  defaultVolume: 0.5,
};

// Renderer settings
export const RENDER_CONFIG = {
  // maxStdDev controls the maximum stddev's from center where the splat is fades out.
  // default is sqrt(8). Sqrt(5) is a good compromise for VR with slightly less visual quality
  // but better performance.
  maxStdDev: Math.sqrt(5),
  // Reduce the resolution of the WebXR framebuffer to improve performance. For splats this
  // doesn't dramatically affect visual quality
  xrFramebufferScaleFactor: 0.5,

  // This sets the LOD splat budget. 1.0 defaults to 1million splats on PC and 500k, on 
  // VR and mobile. However we can get away with 2.0 for VR on Quest 3 
  lodSplatScale: 2.0,
};

// Controls configuration
export const CONTROLS_CONFIG = {
  // Movement speed multiplier (applied to default move speed)
  // Controls get reset if initializing VR, so this is applied after VR initialization
  moveSpeedMultiplier: 3.0,
};

// Scene assets configuration
export const SCENE_CONFIG = {
  // Main scene SPZ file name (gaussian splat scene)
  sceneSpzFileName: 'cozy_ship-lod.spz',
  
  // Proxy mesh file name (simplified mesh for performance)
  proxyMeshFileName: 'cozy_space_ship_mesh2.glb',
  
  // Config file names (loaded from scenes/{sceneName}/ directory)
  configFiles: {
    audioConfig: 'audio-config.json',
    lightingConfig: 'lighting-config.json',
    objectsConfig: 'objects-config.json',
    robotConfig: 'robot-config.json',
  },
  
  // Scene rotation (in radians) - applied to splat scene and collision mesh
  sceneRotation: {
    x: 0,
    y: -Math.PI / 2, // this splat needs rotation to align
    z: 0,
  },
  
  // Player starting position (x, y, z)
  playerStartPosition: {
    x: -2,
    y: 7,
    z: -6.13, // Start in the bedroom
  },
  
  // Feature flags
  flags: {
    // Enable VR support (WebXR with hand tracking)
    enableVR: true,
    
    // Enable physics system (collisions, character physics)
    enablePhysics: true,
    
    // Enable SDF hands (allows "touching" of the scene in VR)
    enableHands: false,
    
    // Enable dynamic objects (enables throw hands, kick/throw actions)
    enableDynamicObjects: true,
    
    // Enable HUD (heads-up display with position info and controls)
    enableHUD: true,
    
    // Enable lighting system (loads lights from lighting-config.json)
    enableLighting: true,
  },
};

