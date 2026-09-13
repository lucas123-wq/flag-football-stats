import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import packageJson from './package.json' with { type: 'json' };

// Technisches Grundgerüst (Schritt 1): Build-Tooling, PWA-Basiskonfiguration
// und Testumgebung. Fachliche Logik (Spieler/Spiele/Events/Datenbank) folgt
// in späteren Schritten gemäß Implementierungsplan.
export default defineConfig({
  // GitHub Pages Project Page: die App wird unter
  // https://<user>.github.io/flag-football-stats/ ausgeliefert, nicht an der
  // Domain-Wurzel. `base` sorgt dafür, dass Vite alle Asset-URLs (JS/CSS,
  // Icons, Manifest) beim Build mit diesem Unterpfad präfigiert – siehe auch
  // `basename` an <BrowserRouter> in `main.tsx` und `start_url`/`scope`/`id`
  // im PWA-Manifest unten, die synchron zu diesem Wert bleiben müssen.
  base: '/flag-football-stats/',
  // App-Version für die Einstellungen-Seite (PRD §45 "App-Version") – direkt
  // aus package.json übernommen (keine neue Abhängigkeit), damit sie nicht
  // separat gepflegt werden muss.
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        // Muss mit `base` oben übereinstimmen (GitHub Pages Project Page).
        id: '/flag-football-stats/',
        name: 'Regensburg Phoenix – Live Stats & Ticker',
        short_name: 'Phoenix Stats',
        description:
          'Offline-fähige PWA zur Live-Erfassung von Flag-Football-Events, Score und Spielerstatistiken für Regensburg Phoenix.',
        lang: 'de',
        start_url: '/flag-football-stats/',
        scope: '/flag-football-stats/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App-Shell + statische Assets werden für Offline-Start vorab gecacht.
        // Eine echte Datenquelle (IndexedDB) gibt es in diesem Schritt noch nicht.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
