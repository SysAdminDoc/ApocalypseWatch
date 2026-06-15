import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/dashboard/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dashboard-api',
              expiration: { maxEntries: 1, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
      manifest: {
        name: 'ApocalypseWatch',
        short_name: 'AW',
        description: 'Private-jet anomaly monitor',
        start_url: process.env.VITE_BASE_PATH ?? '/',
        theme_color: '#06080e',
        background_color: '#06080e',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3030',
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
