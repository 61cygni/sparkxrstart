import { AUDIO_CONIFG } from "./config.js";

// Audio setup
export let bgAudio = null;

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

// Initialize audio with asset resolution
export async function initializeBackgroundAudio(audioURL) {
  bgAudio = new Audio(audioURL);
  bgAudio.loop = true;
  bgAudio.preload = "auto";
  bgAudio.volume = AUDIO_CONIFG.defaultVolume;
  
  // Setup audio toggle button after audio is initialized
  setupAudioToggleButton();
}

export async function startBgAudio() {
  if (!bgAudio) {
    console.error('Background audio not initialized');
    return false;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const audioContext = new AudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    }
    await bgAudio.play();
    return true;
  } catch (error) {
    // Audio play failed - user interaction may be required
    console.warn('Failed to start background audio:', error);
    return false;
  }
}

export async function toggleAudio() {
  if (!bgAudio) {
    console.log('Background audio not initialized');
    return false;
  }
  
  try {
    if (bgAudio.paused) {
      const success = await startBgAudio();
      syncAudioToggle();
      return success;
    } else {
      bgAudio.pause();
      syncAudioToggle();
      return true;
    }
  } catch (error) {
    console.warn('Failed to toggle audio:', error);
    syncAudioToggle();
    return false;
  }
}

// Sync the audio toggle button with the audio state
export function syncAudioToggle() {
  const audioToggleButton = document.getElementById("audio-toggle");
  if (!audioToggleButton || !bgAudio) return;
  audioToggleButton.innerHTML = !bgAudio.paused ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-off"></i>';
  audioToggleButton.setAttribute("aria-label", !bgAudio.paused ? "Pause audio" : "Play audio");
  // Re-initialize icons after dynamically setting innerHTML
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

