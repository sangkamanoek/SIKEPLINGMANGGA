import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.png',
          'logo_pemko_medan.png',
          'logo_pemko_medan.svg',
          'logo_192.png',
          'logo_512.png',
          'logo_maskable.png',
          'apple-touch-icon.png',
        ],
        manifest: {
          id: '/',
          name: 'SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA',
          short_name: 'KINERJA KEPLING',
          description: 'SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA - Aplikasi Pelaporan Kinerja Harian & Dashboard Capaian Kepala Lingkungan',
          theme_color: '#065f46',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/logo_192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/logo_512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/logo_maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: ['es2020', 'edge88', 'firefox78', 'chrome80', 'safari14'],
      cssTarget: ['chrome80', 'firefox78', 'safari14', 'edge88'],
      sourcemap: false,
      chunkSizeWarningLimit: 2500,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
