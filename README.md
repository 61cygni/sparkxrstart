# Spark XR Start

A WebXR starter template using [Spark](https://sparkjs.dev/) for rendering Gaussian Splats in VR/AR experiences. Built with Three.js and Vite for fast development.

## Features

- 🎮 WebXR support with hand tracking
- 🎨 Gaussian Splat rendering via Spark
- 🖐️ SDF-based hand visualization
- 🔊 Background audio with toggle controls
- 📊 HUD overlay with position/FPS display
- ⚡ Vite dev server for hot reload

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
├── hud.js            # HUD overlay display
├── sdf-hand.js       # SDF hand tracking visualization
├── assets.js         # Asset URL resolution (local/CDN fallback)
├── config.js         # Configuration parameters
├── vite.config.js    # Vite configuration
└── public/
    └── assets/       # Local assets (checked first, falls back to CDN)
```

## Configuration

Edit `config.js` to customize:

- **ASSETS_CONFIG**: Local asset path and CDN fallback URL
- **AUDIO_CONFIG**: Default audio volume
- **RENDER_CONFIG**: Splat rendering quality and XR framebuffer settings

## Asset Loading

Assets are loaded using a fallback system:
1. First checks `public/assets/` for local files
2. Falls back to `https://public-spz.t3.storage.dev/` CDN if not found locally

This allows for local development with custom assets while using hosted assets in production.

## Dependencies

- [Three.js](https://threejs.org/) - 3D rendering
- [Spark](https://sparkjs.dev/) - Gaussian Splat rendering and WebXR utilities
- [Vite](https://vitejs.dev/) - Build tooling
- [Lucide](https://lucide.dev/) - UI icons

## License

MIT

