/**
 * GitHub Pages unterstützt keine Server-Rewrites für eine Single-Page-App:
 * ein direkter Aufruf oder Reload einer Unterroute wie
 * `/flag-football-stats/spiele/abc123` liefert ohne diesen Mechanismus die
 * generische GitHub-Pages-404-Seite, weil unter diesem Pfad physisch keine
 * Datei existiert.
 *
 * Etabliertes Muster für Vite/React-SPAs auf GitHub Pages ("spa-github-pages"
 * von rafgraph): `public/404.html` kodiert den eigentlich aufgerufenen Pfad
 * in einen Query-String und leitet auf die App-Wurzel um; `main.tsx` liest
 * diesen Query-String NOCH VOR der Instanziierung von `<BrowserRouter>`
 * wieder aus und stellt über `history.replaceState` den echten Pfad wieder
 * her – React Router sieht die Umleitung dadurch nie.
 *
 * Dieses Modul enthält die reine, getestete Referenz-Implementierung beider
 * Richtungen des Algorithmus:
 * - `buildGithubPagesRedirectUrl` bildet exakt die Logik ab, die als
 *   eigenständiges, bundling-unabhängiges Inline-Skript in
 *   `public/404.html` läuft (GitHub Pages liefert für eine 404 kein
 *   gebautes JS-Bundle aus – das Skript dort MUSS deshalb dependency-frei
 *   bleiben und kann dieses Modul nicht importieren; es bildet exakt
 *   dieselbe, hier geprüfte Logik von Hand nach).
 * - `decodeGithubPagesRedirect` wird tatsächlich von `main.tsx` importiert
 *   und ausgeführt.
 *
 * `GITHUB_PAGES_PATH_SEGMENTS_TO_KEEP = 1`: GitHub Pages liefert die App
 * unter `https://<user>.github.io/flag-football-stats/…` aus – das erste
 * Pfadsegment ("flag-football-stats") muss als App-Wurzel erhalten bleiben.
 * Muss synchron zu `base` in `vite.config.ts` bleiben.
 */
export const GITHUB_PAGES_PATH_SEGMENTS_TO_KEEP = 1;

export interface RedirectLocation {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Referenz-Implementierung des `public/404.html`-Skripts: baut aus dem
 * aufgerufenen Pfad die Umleitungs-URL zur App-Wurzel. Reine Funktion, führt
 * selbst keine Navigation aus.
 */
export function buildGithubPagesRedirectUrl(
  location: RedirectLocation,
  pathSegmentsToKeep: number = GITHUB_PAGES_PATH_SEGMENTS_TO_KEEP,
): string {
  const root = location.pathname
    .split('/')
    .slice(0, 1 + pathSegmentsToKeep)
    .join('/');
  const encodedPath = location.pathname
    .slice(1)
    .split('/')
    .slice(pathSegmentsToKeep)
    .join('/')
    .replace(/&/g, '~and~');
  const encodedSearch = location.search
    ? `&${location.search.slice(1).replace(/&/g, '~and~')}`
    : '';
  return `${root}/?/${encodedPath}${encodedSearch}${location.hash}`;
}

/**
 * Von `main.tsx` verwendet: liest eine ggf. von `public/404.html` gesetzte
 * Umleitung aus `location` wieder aus. Gibt den wiederherzustellenden Pfad
 * (für `history.replaceState`) zurück, oder `null`, wenn keine Umleitung
 * vorliegt (normaler Aufruf ohne vorherige 404.html-Umleitung).
 */
export function decodeGithubPagesRedirect(location: RedirectLocation): string | null {
  if (location.search[1] !== '/') {
    return null;
  }
  const decoded = location.search
    .slice(1)
    .split('&')
    .map((segment) => segment.replace(/~and~/g, '&'))
    .join('?');
  return location.pathname.slice(0, -1) + decoded + location.hash;
}
