/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Chemin de publication. Sur GitHub Pages, le workflow fournit BASE_PATH=/Monopoly-Zapped/
// (https://frst000-ctrl.github.io/Monopoly-Zapped/). Sans variable, base relative :
// l'application fonctionne à la racine d'un domaine comme dans un sous-dossier.
const base = process.env.BASE_PATH || './';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zapped Bank – Banque Monopoly',
        short_name: 'Zapped Bank',
        description: 'Banque électronique pour jouer au Monopoly Zapped sans l’application officielle.',
        lang: 'fr',
        id: base === './' ? '.' : base,
        start_url: base === './' ? '.' : base,
        scope: base === './' ? '.' : base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
