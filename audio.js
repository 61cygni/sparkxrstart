// Audio setup
export let bgAudio = null;
let audioEnabled = false;

// Listeners that get called when audio is toggled
const audioToggleListeners = new Set();

// Register a listener to be called when audio is toggled
// Callback receives (isEnabled: boolean)
export function onAudioToggle(callback) {
  audioToggleListeners.add(callback);
}

// Unregister an audio toggle listener
export function offAudioToggle(callback) {
  audioToggleListeners.delete(callback);
}

// Notify all listeners of audio toggle
function notifyAudioToggleListeners() {
  audioToggleListeners.forEach(callback => callback(audioEnabled));
}

// Get audio enabled state
export function isAudioEnabled() {
  return audioEnabled;
}

// Setup audio toggle button
function setupAudioToggleButton() {
  const audioToggleButton = document.getElementById("audio-toggle");
  if (audioToggleButton) {
    audioToggleButton.addEventListener("click", async () => {
      await toggleAudio();
    });
    syncAudioToggle();
  }
}

/**
 * Initialize background audio by loading configuration from audio-config.json
 * @param {string} sceneName - Name of the scene
 * @param {object} sceneConfig - Scene configuration object
 * @param {function} checkSceneAssets - Asset resolver function
 */
export async function initializeBackgroundAudio(sceneName, sceneConfig, checkSceneAssets) {
  // Load background audio config from audio-config.json
  let BACKGROUND_AUDIO_CONFIG = { backgroundMusicFileName: null, volume: 0.2 };
  
  try {
    const audioConfigUrl = await checkSceneAssets(sceneConfig.configFiles.audioConfig);
    const response = await fetch(audioConfigUrl);
    const audioConfig = await response.json();
    
    // Handle both old format (array) and new format (object with BACKGROUND_AUDIO_CONFIG)
    if (audioConfig.BACKGROUND_AUDIO_CONFIG) {
      BACKGROUND_AUDIO_CONFIG = audioConfig.BACKGROUND_AUDIO_CONFIG;
    }
  } catch (error) {
    console.warn("Failed to load background audio config, using defaults:", error);
  }

  // Initialize background audio. This is played at a constant volume throughout the scene
  if (BACKGROUND_AUDIO_CONFIG.backgroundMusicFileName) {
    const audioURL = await checkSceneAssets(BACKGROUND_AUDIO_CONFIG.backgroundMusicFileName);
    console.log('Using background audio', BACKGROUND_AUDIO_CONFIG.backgroundMusicFileName);
    bgAudio = new Audio(audioURL);
    bgAudio.loop = true;
    bgAudio.preload = "auto";
    const volume = BACKGROUND_AUDIO_CONFIG.volume ?? 0.2;
    bgAudio.volume = volume;
    console.log('Background audio volume set to:', volume);
  } else {
    // No background audio file specified
    bgAudio = null;
  }
  
  // Setup audio toggle button after audio is initialized
  setupAudioToggleButton();
}

export async function startBgAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const audioContext = new AudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    }
    // Only play background audio if it was initialized
    if (bgAudio) {
      await bgAudio.play();
    }
    audioEnabled = true;
    return true;
  } catch (error) {
    // Audio play failed - user interaction may be required
    console.warn('Failed to start background audio:', error);
    return false;
  }
}

export async function toggleAudio() {
  try {
    if (!audioEnabled) {
      const success = await startBgAudio();
      syncAudioToggle();
      notifyAudioToggleListeners();
      return success;
    } else {
      // Only pause background audio if it was initialized
      if (bgAudio) {
        bgAudio.pause();
      }
      audioEnabled = false;
      syncAudioToggle();
      notifyAudioToggleListeners();
      return true;
    }
  } catch (error) {
    console.warn('Failed to toggle audio:', error);
    syncAudioToggle();
    return false;
  }
}

// Turn music on
export async function turnMusicOn() {
  if (!audioEnabled) {
    await toggleAudio();
  }
  return true;
}

// Turn music off
export async function turnMusicOff() {
  if (audioEnabled) {
    await toggleAudio();
  }
  return true;
}

// Sync the audio toggle button with the audio state
export function syncAudioToggle() {
  const audioToggleButton = document.getElementById("audio-toggle");
  if (!audioToggleButton) return;
  audioToggleButton.innerHTML = audioEnabled ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-off"></i>';
  audioToggleButton.setAttribute("aria-label", audioEnabled ? "Pause audio" : "Play audio");
  // Re-initialize icons after dynamically setting innerHTML
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

