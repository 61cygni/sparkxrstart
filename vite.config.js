import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2022' // Support top-level await
  },
  resolve: {
    alias: {
      'three': 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.179.0/three.module.js',
      '@sparkjsdev/spark': 'https://sparkjs.dev/releases/spark/experimental/lod/spark.module.min.js'
    }
  },
  // Exclude CDN imports from optimization
  optimizeDeps: {
    exclude: ['three', '@sparkjsdev/spark']
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
});

