import { checkAssets } from './assets.js';

/**
 * Create a scene-specific asset resolver that checks scene directory first, then falls back to regular asset resolution
 * @param {string} sceneName - Name of the scene
 * @param {object} assetsConfig - Asset configuration
 * @returns {function} - Scene-specific asset resolver function
 */
export function createCheckSceneAssets(sceneName, assetsConfig) {
  return async function checkSceneAssets(filename) {
    // First, try to load from the scene directory
    const scenePath = `/scenes/${sceneName}/${filename}`;
    try {
      const response = await fetch(scenePath);
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          console.log('Using scene asset:', scenePath);
          return scenePath;
        }
      }
    } catch (error) {
      // Scene file doesn't exist, fall through to regular checkAssets
    }
    
    // Fall back to regular asset resolution (checks /assets/ then CDN)
    return checkAssets(filename, assetsConfig);
  };
}

/**
 * @deprecated Use createCheckSceneAssets instead. This function is kept for backwards compatibility.
 * Create a bound version of checkAssets with scene-specific ASSETS_CONFIG
 * @param {object} assetsConfig - Asset configuration
 * @returns {function} - Bound checkAssets function
 */
export function createCheckAssetsWithConfig(assetsConfig) {
  return (filename) => checkAssets(filename, assetsConfig);
}

