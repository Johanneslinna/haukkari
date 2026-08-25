import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 2,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
              maxSize: 350 * 1024,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
        'push-handler.js',
      ],
      manifest: {
        id: '/',
        name: 'Haukkari',
        short_name: 'Haukkari',
        description: 'Treeni, joka elää mukanasi.',
        lang: 'fi-FI',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        background_color: '#f3f6f1',
        theme_color: '#184e42',
        orientation: 'any',
        categories: ['fitness', 'health', 'lifestyle'],
        shortcuts: [
          { name: 'Päivän harjoitus', short_name: 'Harjoitus', url: '/harjoitus' },
          { name: 'Kuntotarkistus', short_name: 'Vointi', url: '/kuntotarkistus' },
          { name: 'Tämä viikko', short_name: 'Viikko', url: '/viikko' },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        importScripts: ['push-handler.js'],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
