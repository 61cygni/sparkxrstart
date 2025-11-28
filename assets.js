import { ASSETS_CONFIG } from './config.js';

// Asset resolution function
export async function checkAssets(filename) {
  const localPath = `${ASSETS_CONFIG.localPath}/${filename}`;
  const cdnPath = `${ASSETS_CONFIG.cdnBaseUrl}/${filename}`;
  
  try {
    // Try to fetch the local file with GET to verify it actually exists
    const response = await fetch(localPath);
    
    // Check if response is OK and not an HTML page (which would indicate a 404)
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      // If it's HTML, it's likely a 404 page, not the actual file
      if (!contentType.includes('text/html')) {
        console.log('using localPath', localPath);
        return localPath;
      }
    }
  } catch (error) {
    // Local file doesn't exist or failed to fetch
  }
  
  // Fall back to CDN
  console.log('falling back to CDN', cdnPath);
  return cdnPath;
}

