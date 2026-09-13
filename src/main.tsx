import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { decodeGithubPagesRedirect } from './pwa/githubPagesSpaRedirect';
import { requestPersistentStorage } from './pwa/persistentStorage';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root-Element "#root" wurde nicht gefunden.');
}

// GitHub Pages Project Page (https://<user>.github.io/flag-football-stats/)
// unterstützt keine Server-Rewrites für eine SPA: `public/404.html` kodiert
// einen direkten Aufruf/Reload einer Unterroute (z. B. .../spiele/abc123) in
// einen Query-String und leitet auf die App-Wurzel um. Das hier stellt den
// echten Pfad synchron wieder her, BEVOR `<BrowserRouter>` instanziiert wird
// und `window.location` liest – React Router sieht die Umleitung nie. Bei
// einem normalen Aufruf (kein 404.html-Redirect) ist `restoredPath` `null`
// und es passiert nichts. Siehe `pwa/githubPagesSpaRedirect.ts`.
const restoredPath = decodeGithubPagesRedirect(window.location);
if (restoredPath !== null) {
  window.history.replaceState(null, '', restoredPath);
}

// Einmalig beim App-Start, bewusst nicht awaited: darf den Start/das erste
// Rendern nicht blockieren, und das Ergebnis hat keine UI-Auswirkung (siehe
// `persistentStorage.ts`). IndexedDB funktioniert unabhängig vom Ausgang.
void requestPersistentStorage();

createRoot(rootElement).render(
  <StrictMode>
    {/* `basename` muss zum GitHub-Pages-Unterpfad passen (siehe `base` in
        vite.config.ts und `public/404.html`/`githubPagesSpaRedirect.ts`). */}
    <BrowserRouter basename="/flag-football-stats">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
