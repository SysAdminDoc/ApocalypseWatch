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
        theme_color: '#06080e',
        background_color: '#06080e',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
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
