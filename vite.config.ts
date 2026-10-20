import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'cubby',
        short_name: 'cubby',
        description: 'Dump anything. Ask anything. Nothing leaves your device.',
        theme_color: '#0e0f11',
        background_color: '#0e0f11',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
        // Share-to-cubby (SPEC §1.3, RISKS R8): Android-solid, iOS-weak —
        // platforms without support simply never offer cubby in the Share sheet.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      workbox: {
        // App shell precached by default. Model weights are fetched
        // cross-origin from the HF hub at runtime — cache them once so
        // offline search keeps working after first load (ARCHITECTURE §6).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'embeddinggemma-model',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
    }),
  ],
})
