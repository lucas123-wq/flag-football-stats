# Regensburg Phoenix – Live Stats & Ticker

Installierbare, offline-fähige Progressive Web App (PWA) zur Live-Erfassung von
Flag-Football-Spielereignissen, Score und Spielerstatistiken für Regensburg Phoenix.

> **Status:** Projektgrundgerüst + lokale Datenbank (Schritt 1–2). Es gibt noch keine
> Benutzeroberfläche für Spieler/Spiele/Events, keine Score-/Statistikberechnung und keine
> WhatsApp-Funktion – siehe [PRD.md](./PRD.md) für die vollständigen Produktanforderungen.

## Tech-Stack

- React 19 + TypeScript
- Vite (Build/Dev-Server)
- Tailwind CSS v4
- `vite-plugin-pwa` (Workbox) – Web App Manifest + Service Worker
- Dexie.js (IndexedDB) – lokale, dauerhafte Datenhaltung (Spieler/Spiele/Events)
- Vitest + React Testing Library (`fake-indexeddb` für IndexedDB in Tests)

## Lokal starten

Voraussetzung: Node.js ≥ 20 (LTS empfohlen).

```bash
npm install
npm run dev
```

Die App ist danach unter `http://localhost:5173` erreichbar.

## Weitere Skripte

| Skript                   | Zweck                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| `npm run build`          | Typprüfung + Produktions-Build (inkl. Service Worker) nach `dist/`          |
| `npm run preview`        | Produktions-Build lokal ausliefern (zum Testen des PWA-/Offline-Verhaltens) |
| `npm run typecheck`      | Nur TypeScript-Typprüfung (`tsc -b`)                                        |
| `npm run lint`           | ESLint                                                                      |
| `npm run format`         | Prettier (schreibt Änderungen)                                              |
| `npm run format:check`   | Prettier (prüft nur)                                                        |
| `npm run test`           | Vitest einmalig ausführen                                                   |
| `npm run test:watch`     | Vitest im Watch-Modus                                                       |
| `npm run generate-icons` | Platzhalter-App-Icons unter `public/icons/` neu erzeugen                    |

## Offline/PWA testen

`npm run dev` registriert den Service Worker standardmäßig nicht (Entwicklungsmodus).
Für einen realistischen Offline-Test:

```bash
npm run build
npm run preview
```

Danach im Browser die Netzwerkverbindung deaktivieren (DevTools → Network → Offline) und die
Seite neu laden – die App-Shell wird aus dem Service-Worker-Cache geladen.

## Projektstruktur

```text
src/
  domain/       Typen/Enums (Player, Game, GameEvent), Event-Validierung – siehe src/domain/README.md
  data/         Dexie-Schema + Repositories (players/games/events) – siehe src/data/README.md
  features/     Seiten/Screens je Bereich (Spiele, Spieler, Einstellungen) – noch leer
  components/   wiederverwendbare UI-Bausteine – noch leer
  pwa/          Service-Worker-Anbindung (Offline-/Update-Hinweis)
  test/         Testkonfiguration (Vitest-Setup inkl. fake-indexeddb-Polyfill)
scripts/
  generate-icons.mjs   erzeugt Platzhalter-PNG-Icons ohne externe Abhängigkeiten
```
