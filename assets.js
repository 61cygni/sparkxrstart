/**
 * Asset resolution function
 * @param {string} filename - Name of the asset file
 * @param {object} assetsConfig - Asset configuration (optional)
 * @param {string} assetsConfig.localPath - Local path prefix (default: '/assets')
 * @param {string} assetsConfig.cdnBaseUrl - CDN base URL (default: 'https://public-spz.t3.storage.dev')
 * @returns {Promise<string>} - Resolved asset URL
 */
export async function checkAssets(filename, assetsConfig = {}) {
  const {
    localPath = '/assets',
    cdnBaseUrl = 'https://public-spz.t3.storage.dev',
  } = assetsConfig;
  
  // Remove trailing slash from localPath if present, then add filename
  const normalizedLocalPath = localPath.endsWith('/') ? localPath.slice(0, -1) : localPath;
  const localPathFull = `${normalizedLocalPath}/${filename}`;
  const cdnPath = `${cdnBaseUrl}/${filename}`;


  
  try {
    console.log('checking localPathFull', localPathFull);
    // Try to fetch the local file with GET to verify it actually exists
    const response = await fetch(localPathFull);
    
    // Check if response is OK and not an HTML page (which would indicate a 404)
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      // If it's HTML, it's likely a 404 page, not the actual file
      if (!contentType.includes('text/html')) {
        console.log('using localPath', localPathFull);
        return localPathFull;
      }
    }
  } catch (error) {
    // Local file doesn't exist or failed to fetch
  }
  
  // Fall back to CDN
  console.log('falling back to CDN', cdnPath);
  return cdnPath;
}

