// jsdom implementiert IndexedDB nicht selbst – für Dexie-basierte Tests wird
// hier ein vollständiger In-Memory-Polyfill bereitgestellt.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Da die Vitest-Config bewusst `globals: false` verwendet, registriert
// @testing-library/react sein automatisches DOM-Cleanup nicht selbst (das
// setzt ein globales `afterEach` voraus). Ohne dieses Cleanup bleiben
// gerenderte Komponenten mehrerer Tests im selben `document.body` stehen.
afterEach(() => {
  cleanup();
});

// vite-plugin-pwa stellt dieses virtuelle Modul erst im echten Vite-Build/Dev-
// Kontext bereit. Für Komponententests wird ein einfacher No-Op-Stub verwendet,
// damit Tests unabhängig vom Service-Worker-Setup laufen.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, () => {}],
    needRefresh: [false, () => {}],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));
