// Configuration file for tweakable parameters

// Asset paths
// Asset lookup will first check localPath (vite defaults to public/) Then will
// check the cdn URL. 
export const ASSETS_CONFIG = {
  localPath: '/assets',
  cdnBaseUrl: 'https://public-spz.t3.storage.dev'
};

// Audio settings
export const AUDIO_CONIFG = {
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

