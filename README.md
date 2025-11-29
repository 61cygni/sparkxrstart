# Spark XR Start

![Console Screenshot](public/console.png)

A WebXR starter template using [three.js](https://threejs.org/) and [Spark](https://sparkjs.dev/) for web / VR experiences using gaussian splats as the background.  

You can see a hosted version [here](https://sparkxrstart.netlify.app/)

## Features

- 🎮 WebXR support with hand tracking
- 🎨 Gaussian Splat rendering via Spark with LoD to support truly massive scenes
- 🔊 Stereoscopic audio and spatial audio triggers 
- 📊 HUD overlay with position/FPS display

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
├── index.html        # Main HTML entry point
├── main.js           # Application entry point
├── scene.js          # Scene creation and animation loop
├── audio.js          # Background audio management
├── spatial-audio.js  # 3D positional audio system
├── hud.js            # HUD overlay display
├── sdf-hand.js       # SDF hand tracking visualization
├── assets.js         # Asset URL resolution (local/CDN fallback)
├── config.js         # Configuration parameters
├── vite.config.js    # Vite configuration
└── public/
    └── assets/       # Local assets (checked first, falls back to CDN)
        └── audio-config.json  # Spatial audio source definitions
```

## Asset Loading

Assets are loaded using a fallback system:
1. First checks `public/assets/` for local files
2. Falls back to CDN if not found locally. Currently it's configured to use my public bucket on [Tigris](https://www.tigrisdata.com/). 

This allows for local development with custom assets while using hosted assets in production.

## Spatial Audio

The spatial audio system places 3D positional audio sources in the scene. Audio sources can be continues or triggered once when the user is nearby.  Configure sources in `public/assets/audio-config.json`:

```json
[
  {
    "audio_url": "my-sound.mp3",
    "audio_position": [1.0, 2.0, -3.0],
    "falloff": {
      "refDistance": 5,
      "rolloffFactor": 1,
      "maxDistance": 50,
      "volume": 0.8,
      "loop": true
    }
  },
  {
    "audio_url": "trigger-sound.mp3",
    "audio_position": [0, 1, 0],
    "triggerRadius": 2,
    "falloff": {
      "loop": false
    }
  }
]
```

### Options

| Property | Description | Default |
|----------|-------------|---------|
| `audio_url` | Path to audio file (resolved via asset system) | required |
| `audio_position` | [x, y, z] position in scene | required |
| `falloff.refDistance` | Distance at which volume is 100% | 5 |
| `falloff.rolloffFactor` | How quickly sound fades with distance | 1 |
| `falloff.maxDistance` | Maximum audible distance | 50 |
| `falloff.volume` | Base volume (0-1) | 1 |
| `falloff.loop` | Whether audio loops | true |
| `triggerRadius` | Proximity radius to trigger non-looping audio | null |

### Features

- **Looping sources** play automatically when audio is enabled
- **Triggered sources** (with `triggerRadius`) play once when the user enters the radius
- **Debug visualization**: Enable HUD to see red wireframe spheres at audio source locations
- Audio sources respond to the global audio toggle (on/off)

### Deploying

This project is easily deployable to any static hosting site (e.g. Netlify). I prefer to deploy directly rather than going through git. So the workflow I use is as follows:

1. **Install Netlify CLI** (if you haven't already):
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**:
   ```bash
   netlify login
   ```
   This will open your browser to authenticate with your Netlify account.

3. **Deploy to production**:
   ```bash
   netlify deploy --prod
   ```
   
   On your first deployment, Netlify will ask if you want to create a new site or link to an existing site:
   - **Create a new site**: Choose this if you're deploying for the first time

4. **That's it!** After the deployment completes, you'll see your live URL (e.g., `https://your-site-name.netlify.app`).

The `netlify.toml` file in this project is already configured with the correct build settings, so Netlify will automatically:
- Run `npm run build`
- Deploy the `dist` folder
- Set up proper redirects for single-page applications

**Note:** Each time you make changes and want to update your live site, just run `netlify deploy --prod` again from your project directory.


## Dependencies

- [Three.js](https://threejs.org/) - 3D rendering
- [Spark](https://sparkjs.dev/) - Gaussian Splat rendering and WebXR utilities
- [Vite](https://vitejs.dev/) - Build tooling
- [Lucide](https://lucide.dev/) - UI icons

## Credits

Based on code written by Winnie Lin

## License

MIT

