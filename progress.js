// Progress Module
// Handles loading progress overlay display

// Get DOM elements
const overlay = document.getElementById("mobile-overlay");
const overlayMessage = document.getElementById("overlay-message");
const progressStatus = document.getElementById("progress-status");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");

/**
 * Show the progress overlay
 * @param {string} message - Message to display in the overlay
 */
export function showProgress(message = "Loading...") {
  overlayMessage.textContent = message;
  progressStatus.textContent = "0.0 MB downloaded";
  progressBar.style.display = "block";
  progressFill.style.width = "0%";
  overlay.classList.add("visible");
}

/**
 * Update progress display
 * @param {number} progress - Progress value between 0 and 1
 * @param {number} loadedBytes - Number of bytes loaded
 * @param {number|null} totalBytes - Total number of bytes (null if unknown)
 */
export function updateProgress(progress, loadedBytes = 0, totalBytes = null) {
  const clamped = Math.min(1, Math.max(0, progress));
  progressFill.style.width = `${clamped * 100}%`;
  if (typeof loadedBytes === "number") {
    const loadedMB = loadedBytes / (1024 * 1024);
    if (totalBytes) {
      const totalMB = totalBytes / (1024 * 1024);
      progressStatus.textContent = `${loadedMB.toFixed(1)} / ${totalMB.toFixed(1)} MB downloaded`;
    } else if (loadedBytes > 0) {
      progressStatus.textContent = `${loadedMB.toFixed(1)} MB downloaded`;
    } else {
      progressStatus.textContent = "0.0 MB downloaded";
    }
  }
}

/**
 * Hide the progress overlay
 */
export function hideProgress() {
  overlay.classList.remove("visible");
  progressBar.style.display = "none";
  progressFill.style.width = "0%";
  progressStatus.textContent = "";
  overlayMessage.textContent = "";
  // Show instructions overlay after progress is hidden
  document.addEventListener("click", dismissInstructions, { once: true });
}

/**
 * Dismiss instructions overlay (placeholder for future implementation)
 */
function dismissInstructions() {
  // instructionsOverlay.classList.remove("visible");
}

/**
 * Calculate approximate progress when total size is unknown
 * @param {number} loadedBytes - Number of bytes loaded
 * @returns {number} Estimated progress value between 0 and 1
 */
export function calculateUnknownProgress(loadedBytes) {
  const midpoint = 10 * 1024 * 1024; // 10MB heuristic
  return loadedBytes / (loadedBytes + midpoint);
}

