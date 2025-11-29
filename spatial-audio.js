import * as THREE from "three";

import { isAudioEnabled, onAudioToggle } from "./audio.js";
import { isHudEnabled, onHudToggle } from "./hud.js";

export const audioListener = new THREE.AudioListener();
export const spatialAudioSources = [];
const audioLoader = new THREE.AudioLoader();

/**
 * Add a spatial audio source to the scene
 * @param {string} audioUrl - URL to the audio file
 * @param {THREE.Vector3} position - Position of the audio source in 3D space
 * @param {object} options - Configuration options
 * @param {number} options.refDistance - Reference distance for falloff (default: 5)
 * @param {number} options.rolloffFactor - How quickly the sound fades (default: 1)
 * @param {number} options.maxDistance - Maximum distance the sound can be heard (default: 50)
 * @param {boolean} options.loop - Whether the audio should loop (default: true)
 * @param {number} options.volume - Volume of the audio (default: 1)
 * @param {number} options.triggerRadius - Proximity radius to trigger non-looping audio (optional)
 * @returns {Promise<THREE.PositionalAudio>} The created positional audio object
 */

export async function addSpatialAudioSource(audioUrl, position, options = {}) {
    const {
      refDistance = 5,
      rolloffFactor = 1,
      maxDistance = 50,
      loop = true,
      volume = 1,
      triggerRadius = null
    } = options;
  
    return new Promise((resolve, reject) => {
      const positionalAudio = new THREE.PositionalAudio(audioListener);
      
      audioLoader.load(
        audioUrl,
        (buffer) => {
          positionalAudio.setBuffer(buffer);
          positionalAudio.setRefDistance(refDistance);
          positionalAudio.setRolloffFactor(rolloffFactor);
          positionalAudio.setMaxDistance(maxDistance);
          positionalAudio.setLoop(loop);
          positionalAudio.setVolume(volume);
          
          // Create a visual marker for the audio source (optional, for debugging)
          const audioMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true})
          );
          audioMesh.position.copy(position);
          audioMesh.add(positionalAudio);

          // Show audio mesh spheres when HUD is enabled
          audioMesh.visible = isHudEnabled();
          
          spatialAudioSources.push({
            audio: positionalAudio,
            mesh: audioMesh,
            url: audioUrl,
            loop: loop,
            triggerRadius: triggerRadius,
            triggered: false, // Track if non-looping audio has been triggered
            position: position.clone()
          });
          
          resolve(positionalAudio);
        },
        (progress) => {
          console.log(`Loading audio: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        },
        (error) => {
          console.error('Error loading audio:', error);
          reject(error);
        }
      );
    });
  }
  
  export async function addMultipleSpatialAudioSources(audioList) {
    const promises = audioList.map(({ audio_url, audio_position, falloff = {}, triggerRadius = null }) => {
      const position = new THREE.Vector3(...audio_position);
      return addSpatialAudioSource(audio_url, position, { ...falloff, triggerRadius });
    });
    
    return Promise.all(promises);
  }

// Update debug mesh visibility based on HUD state
function setSpatialAudioDebugVisibility(visible) {
  for (const source of spatialAudioSources) {
    source.mesh.visible = visible;
  }
}

// Start or stop all spatial audio based on audio enabled state
function setSpatialAudioEnabled(enabled) {
  for (const source of spatialAudioSources) {
    if (enabled) {
      // Only auto-play looping sources; triggered sources stay manual
      if (source.loop && !source.audio.isPlaying) {
        source.audio.play();
      }
    } else {
      if (source.audio.isPlaying) {
        source.audio.pause();
      }
    }
  }
}

  // Check proximity for triggered audio sources
export function checkProximityTriggers(listenerPosition) {
    if (!isAudioEnabled()) return;
    
    for (const source of spatialAudioSources) {
      // Only check non-looping audio with triggerRadius defined
      if (!source.loop && source.triggerRadius && !source.triggered) {
        const distance = listenerPosition.distanceTo(source.position);
        
        // Trigger audio if within radius
        if (distance <= source.triggerRadius) {
          source.audio.play();
          source.triggered = true;
          console.log(`Triggered audio: ${source.url}`);
        }
      }
    }
  }

  // Initialize audio system
export async function initializeSpatialAudio(sparkScene, configURL, assetUrlFn) {
    
    // Attach audio listener to localFrame so positional audio works
    sparkScene.localFrame.add(audioListener);
    
    // Register for HUD toggle events to show/hide debug meshes
    onHudToggle(setSpatialAudioDebugVisibility);
    
    // Register for audio toggle events to start/stop spatial audio
    onAudioToggle(setSpatialAudioEnabled);

    // Initialize spatial audio sources by loading config from JSON
    let audioSources = [];
    try {
      const audioConfigUrl = await assetUrlFn(configURL);
      const response = await fetch(audioConfigUrl);
      const audioConfig = await response.json();
      
      // Map the audio URLs using getAssetUrl (must await each one)
      audioSources = await Promise.all(audioConfig.map(async (source) => ({
        ...source,
        audio_url: await assetUrlFn(source.audio_url)
      })));
      
      console.log(`Loaded ${audioSources.length} audio source configurations`);
    } catch (error) {
      console.error("Failed to load audio configuration:", error);
    }
  
    // Load and add all spatial audio sources
    if (audioSources.length > 0) {
      try {
        await addMultipleSpatialAudioSources(audioSources);
        // Add audio meshes to scene
        spatialAudioSources.forEach(source => {
          sparkScene.scene.add(source.mesh);
        });
        console.log(`Successfully loaded ${spatialAudioSources.length} spatial audio source(s)`);
      } catch (error) {
        console.error("Failed to load spatial audio sources:", error);
      }
    }
  }