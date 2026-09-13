# features

Seiten/Screens, gruppiert nach Bereich.

- `games/` – Spielverwaltung + Live-Spielbildschirm (PRD §11–§17): Übersicht (neueste zuerst),
  Anlegen (Gegner + Datum), Detailseite (`GameDetailPage`, Route `/spiele/:gameId`) als
  Live-Spielbildschirm mit `Scoreboard` (Spielstand, live aus den Events berechnet über
  `domain/scoring.ts`), `GameStatusBadge` (Halbzeit/Status) und `EventButtonGrid` (Event-Buttons
  für eigene Mannschaft/Gegner, siehe `liveEventButtons.ts`). Löschen inkl. zugehöriger Events.
  **Alle elf Event-Typen der Eigene-Mannschaft-/Gegner-Buttons sind vollständig
  funktionsfähig**: Touchdown, 1-/2-Punkt-Conversion, First Down, Interception, Pick 6, Pick 2,
  Sack, Safety, 1-Punkt-Safety und Turnover on Downs (`TouchdownFlow.tsx`, `ConversionFlow.tsx`,
  `FirstDownFlow.tsx`, `InterceptionFlow.tsx`, `PickFlow.tsx`, `SackFlow.tsx`, `SafetyFlow.tsx`,
  `TurnoverOnDownsFlow.tsx`: Auswahl → Bestätigung → Speichern → WhatsApp-Text mit
  Kopieren-Button). Alle Flows teilen sich gemeinsame UI-Bausteine (`EventFlowUI.tsx`:
  `FlowOverlay`, `PlayerPicker`, `ConfirmView`) zur Vermeidung von Duplikation.
  **Turnover on Downs** (Erweiterung über die PRD hinaus, siehe `domain/turnoverOnDowns.ts`):
  NEGATIVE Statistik – der Eigene-Mannschaft-Button wird geklickt, wenn die EIGENE Offense den
  Ball durch Nicht-Erreichen des First Downs verliert, nicht wenn das eigene Team ihn dadurch
  gewinnt. Anders als First Down/Interception/Sack erfasst dieser Flow für KEIN Team einen Spieler
  (`TurnoverOnDownsFlow.tsx` zeigt daher immer direkt die Bestätigungsseite, ohne
  `PlayerPicker`-Schritt). Es gibt aktuell keine verbleibenden Platzhalter-Buttons mehr im
  Live-Spielbildschirm.
  **Spielablauf** (Halbzeit → "Weiter geht's" → 2-Minuten-Warnung → Spielende, PRD §27–§31, siehe
  `domain/gameFlow.ts`): eigene Buttons, die je nach `Game.status` ein-/ausgeblendet werden
  (`canStartHalftime`/`canResumeSecondHalf`/`canTriggerTwoMinuteWarning`/`canFinishGame`). Jede der
  vier Aktionen speichert wie in der PRD vorgesehen ein eigenes Steuerungs-`GameEvent`
  (`HALFTIME`/`SECOND_HALF_START`/`TWO_MIN_WARNING`/`GAME_END`) mit `team: null`/`points: 0` (kein
  Einfluss auf Score/Statistik). Halbzeit und Spielende speichern das Event und ändern danach
  `Game.status`; "Weiter geht's" ändert zuerst `Game.status` und speichert danach das Event
  (Reihenfolge folgt der PRD); beide zeigen zusätzlich eine WhatsApp-Nachricht ("Weiter geht's" im
  exakten PRD-Wortlaut aus §30, nicht im "Spielstand:"-Format der übrigen drei).
  2-Minuten-Warnung speichert nur das Event und die Nachricht, ohne Status-/Score-Wechsel, beliebig
  oft wiederholbar. Spielende fragt vorher über `window.confirm(...)` nach Bestätigung. Nach
  `FINAL` sind alle Event- und Ablauf-Buttons deaktiviert bzw. ausgeblendet, nur "Spiel löschen"
  bleibt verfügbar.
  **Liveticker + Bearbeiten/Löschen** (PRD §36, §39, §41, §42, siehe `domain/liveTicker.ts`/
  `domain/eventEditing.ts`): `EventTicker.tsx` rendert dieselben `TickerEntry`-Daten sowohl
  kompakt als "Letzte Events" als auch vollständig als Liveticker – keine zweite Datenquelle oder
  Darstellung. Pro Eintrag erscheinen "Bearbeiten"/"Löschen"-Buttons nur, wenn
  `Game.status === FINAL` UND das Event kein Steuerungs-Event ist (§41 wörtlich: "Abgeschlossene
  Spiele"). `EventEditFlow.tsx` (wiederverwendet `FlowOverlay`/`PlayerPicker` aus
  `EventFlowUI.tsx`) startet immer mit den aktuellen Werten vorausgefüllt und erlaubt gezielt
  einzelne Felder zu ändern (Spieler bei Einzelspieler-Events, QB/Receiver bei Passing TD –
  gegenseitig ausgeschlossen –, Erfolg + ggf. Spieler bei Conversions); die eigentliche
  Feldänderung läuft über denselben Domain-Builder wie bei der Neuanlage (z. B.
  `buildRushingTouchdownEvent`), sodass `points` nie manuell gesetzt wird und `type`/`team`/`half`
  unangetastet bleiben. Löschen nutzt `window.confirm(...)` wie "Spiel löschen". Beides erzeugt
  bewusst KEINE neue WhatsApp-Nachricht (§42); Score/Statistik werden automatisch aus den
  aktualisierten Events neu abgeleitet (keine zusätzliche Recompute-Logik nötig).
  **Doppelklick-Schutz** (`useActionGuard.ts`): ein `useRef`-basierter Guard, der synchron VOR dem
  ersten `await` einer Aktion gesetzt wird (ein `useState`-Flag wie `isBusy`/`isSaving` allein
  reicht nicht, da State-Updates erst beim nächsten Render sichtbar werden) – verhindert
  zuverlässig, dass zwei echt überlappende Klicks (kein normaler Doppelklick, sondern z. B. zwei
  `fireEvent.click()` ohne await dazwischen) ein Event doppelt speichern. Ursprünglich lokal in
  `GameDetailPage.tsx` für die vier Spielablauf-Aktionen sowie Event-Löschen eingeführt, jetzt als
  gemeinsamer Hook extrahiert und zusätzlich von allen neun Event-Erfassungs-Flows verwendet
  (Touchdown, Conversion, First Down, Interception, Pick 6/2, Sack, Safety/1-Punkt-Safety) – deren
  jeweiliger `handleConfirm` läuft komplett innerhalb von `actionGuard.run(...)`. Für Fälle mit
  einem dazwischenliegenden `window.confirm(...)` (Spielende, Event-Löschen) wird stattdessen
  `begin()`/`release()` genutzt, da `run()` dafür nicht passt.
  **Tab-Struktur für abgeschlossene Spiele** (PRD §37, siehe `GameTabs.tsx`): Solange
  `Game.status !== FINAL`, bleibt der oben beschriebene Live-Spielbildschirm unverändert bestehen
  (§37 gilt wörtlich nur für "ein abgeschlossenes Spiel"). Bei `FINAL` ersetzt `GameTabs.tsx` die
  Event-Erfassung durch vier Tabs in PRD-Reihenfolge – ÜBERSICHT (`GameOverviewTab.tsx`: PRD §38,
  zeigt "Letzte Events" gemäß §36, schreibgeschützt), LIVETICKER (vollständiger, schreibgeschützter
  `EventTicker`, PRD §39), STATISTIKEN (`GameStatsTab.tsx`, PRD §40 + Team-Gesamtstatistik-
  Erweiterung: eigener, klar abgetrennter "Teamstatistik"-Abschnitt vor den bestehenden
  Spielerstatistiken, beide Teams immer sichtbar inkl. 0-Werten, Werte rein aus
  `domain/teamStats.ts#calculateTeamStats` abgeleitet – keine zweite Statistiklogik in der UI) und
  BEARBEITEN (derselbe vollständige `EventTicker` wie LIVETICKER, aber mit den echten,
  unveränderten Bearbeiten-/Löschen-Regeln aus `domain/eventEditing.ts`, plus "Spiel löschen").
  Lokaler
  Komponenten-State statt eigener Routen – ÜBERSICHT ist nach jedem Neuladen wieder der aktive Tab.
  Gemeinsamer Kopfbereich (Zurück-Link, Datum, `Scoreboard`, `GameStatusBadge`, ggf. letzte
  WhatsApp-Nachricht) wird unabhängig vom Tab nur einmal gerendert.
- `players/` – Spieler-Verwaltung (PRD §9, §43, §44): Übersicht (aktiv/inaktiv getrennt),
  Anlegen/Bearbeiten-Formular mit Validierung, Aktivieren/Deaktivieren. Kein physisches Löschen
  (siehe `src/data/players.ts`).
- `settings/` – Einstellungen (PRD §45, Route `/einstellungen`). "Alle Daten löschen" (voll
  funktionsfähig, `window.confirm(...)` mit dem PRD-Wortlaut als Sicherheitsabfrage, nutzt
  `data/db.ts#clearAllData()`, danach Navigation zurück zur Spiele-Startseite) sowie "App-Version"
  (aus `package.json` injiziert, siehe `vite.config.ts`/`__APP_VERSION__`).
  **Daten exportieren/importieren** (PRD §5, siehe `domain/backup.ts`/`data/backup.ts`): "Daten
  exportieren" liest den vollständigen aktuellen Datenbestand und bietet ihn sofort als lokale
  JSON-Datei zum Download an (`regensburg-phoenix-backup-<Zeitstempel>.json`). "Daten importieren"
  öffnet die Dateiauswahl; die gewählte Datei wird SOFORT vollständig geparst und validiert
  (`parseBackupJson`) – bei einem ungültigen Backup erscheint direkt eine Fehlermeldung, ohne dass
  irgendetwas an der Datenbank geändert wird. Bei einem gültigen Backup erscheint eine
  Vorschau-Karte ("Backup gefunden": Anzahl Spieler/Spiele/Events, Erstellungszeitpunkt, deutlicher
  Hinweis, dass der bestehende Datenbestand vollständig ersetzt wird) mit "Jetzt
  importieren"/"Abbrechen" als einzige, klare Bestätigung – bewusst eine eigene Vorschau-Karte statt
  `window.confirm(...)`, da diese Aktion (Restore = vollständiger Ersatz der gesamten Datenbank statt
  z. B. eines einzelnen Spiels) deutlich mehr betrifft als die übrigen destruktiven Aktionen der App
  und die konkreten Zahlen vor der Bestätigung sichtbar sein sollen. Erst nach Bestätigung
  `data/backup.ts#restoreBackup` (atomare Dexie-Transaktion). Import ersetzt den bestehenden
  Datenbestand vollständig (PRD §5: "Wiederherstellung", kein Merge-Verhalten beschrieben). Nach
  Erfolg eine Erfolgsmeldung mit den importierten Zahlen; alle Ansichten aktualisieren sich
  automatisch (bestehende `useLiveQuery`-Reaktivität, keine zusätzliche Logik nötig). "Alle Daten
  löschen" bleibt davon unberührt funktionsfähig.

Noch nicht enthalten: keine offenen Backup-bezogenen Punkte.
