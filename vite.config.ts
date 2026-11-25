import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'Shahani Rajib Official App',
          short_name: 'Shahani',
          description: 'শাহানী রাজীব - প্রজেক্ট ম্যানেজার, প্রভাষক, জাদুকর, রুবিক্স কিউব এক্সপার্ট এবং লেখক।',
          theme_color: '#0d0d17',
          background_color: '#070711',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Precache only core app shell & icons (avoid eagerly downloading ~24MB of subpage PNGs upfront)
          globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}', 'pwa-*.png', 'apple-touch-icon.png'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
          runtimeCaching: [
            {
              urlPattern: /^\/assets\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'shahani-assets-cache',
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
            {
              urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'shahani-drive-images',
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) return 'firebase';
            if (id.includes('node_modules/lucide-react')) return 'icons';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
