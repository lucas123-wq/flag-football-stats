# domain

Reine, UI- und datenbankfreie Fachlogik.

- `types.ts` – Entitäten (`Player`, `Game`, `GameEvent`) sowie Enums/Konstanten (`TEAM`,
  `GAME_STATUS`, `HALF`, `EVENT_TYPE`).
- `id.ts` – ID-Erzeugung für neue Entitäten.
- `eventValidation.ts` – strukturelle Konsistenzprüfung eines Events (Team-/Spielerzuordnung,
  QB/Receiver bei Passing TD, Conversion-Erfolg usw.), siehe PRD §16–§31.
- `playerValidation.ts` – Validierung von Spieler-Formulardaten (Pflichtfelder, Trikotnummernbereich,
  Duplikatsprüfung unter aktiven Spielern).
- `gameValidation.ts` – Validierung von Spiel-Formulardaten (Gegnername, Datum erforderlich).
- `scoring.ts` – `calculateScore(events)`: berechnet den Spielstand rein aus den Events (PRD §35,
  Single Source of Truth). Kein persistierter Score.
- `stats.ts` – `calculatePlayerStats(events, playerId)`: berechnet Spielerstatistiken rein aus den
  Events. Deckt alle implementierten Event-Typen ab (Touchdown, Conversion, First Down,
  Interception, Pick 6, Pick 2, Sack, Safety, 1-Punkt-Safety). `getParticipantPlayerIds(events)`
  (PRD §40): ermittelt die Menge der an einem Spiel beteiligten Spieler-IDs (`playerId`/`qbId`/
  `receiverId`) für die Statistik-Ansicht eines Spiels – rein aus den Events, unabhängig vom
  aktuellen aktiv/inaktiv-Status eines Spielers (siehe `playerValidation.ts`/PRD §9.2).
- `gameHalf.ts` – `resolveCurrentHalf(status)`: leitet die aktuell gültige Halbzeit aus dem
  `GAME_STATUS` ab (für die `half`-Zuordnung neuer Events).
- `gameFlow.ts` – Steuerungslogik für den Spielablauf Halbzeit → "Weiter geht's" →
  2-Minuten-Warnung → Spielende (PRD §27–§31): einzelne, unabhängig testbare Wächterfunktionen
  (`canRecordEvents`, `canStartHalftime`, `canResumeSecondHalf`, `canFinishGame`,
  `canTriggerTwoMinuteWarning`) statt einer generischen State-Machine-Abstraktion, Event-Konstruktion
  (`buildHalftimeEvent`, `buildSecondHalfStartEvent`, `buildTwoMinuteWarningEvent`,
  `buildGameEndEvent`) sowie die vier WhatsApp-Textgeneratoren (`formatHalftimeMessage`,
  `formatTwoMinuteWarningMessage`, `formatSecondHalfStartMessage`, `formatGameEndMessage`). Wie in
  der PRD vorgesehen speichert jede der vier Aktionen ein eigenes Steuerungs-`GameEvent`
  (`HALFTIME`/`SECOND_HALF_START`/`TWO_MIN_WARNING`/`GAME_END`, siehe `CONTROL_EVENT_TYPES` in
  `types.ts`) mit `team: null` und `points: 0` – dadurch fließen diese Events nie in
  `calculateScore()`/`calculatePlayerStats()` ein. Alle vier WhatsApp-Textgeneratoren übernehmen den
  PRD-Wortlaut exakt: Halbzeit/"Weiter geht's"/Spielende folgen dem Format
  `<Titel>\nRegensburg Phoenix X:Y Gegner` (PRD §28/§30/§31), die 2-Minuten-Warnung dem Format
  `2-Minuten-Warnung\nSpielstand: X:Y` (PRD §27).
- `touchdown.ts` – Touchdown-spezifische Event-Konstruktion (Rushing/Passing/Gegner) und
  WhatsApp-Textgenerierung (PRD §17). Bewusst nicht generisch für alle Eventtypen.
- `conversion.ts` – 1-/2-Punkt-Conversion-spezifische Event-Konstruktion und
  WhatsApp-Textgenerierung (PRD §18/§19), analog zu `touchdown.ts`. WhatsApp-Label exakt aus der
  PRD ("1 Pt Conversion"/"2 Pt Conversion"); ein Fehlschlag ändert den Score nie und erzeugt daher
  eine einzeilige Nachricht ohne Spielstand-Zeile (`<Label> <Team> – nicht gut`, PRD-Wortlaut exakt
  übernommen).
- `firstDown.ts` – First-Down-spezifische Event-Konstruktion und WhatsApp-Textgenerierung (PRD
  §20), analog zu `touchdown.ts`/`conversion.ts`. Keine Rushing/Passing-Unterscheidung, 0 Punkte;
  da der Score sich nie ändert, enthält die Nachricht bewusst KEINE Spielstand-Zeile (Regel: der
  Spielstand wird nur mitgesendet, wenn er sich durch das Event tatsächlich ändert).
- `interception.ts` – Interception-spezifische Event-Konstruktion und WhatsApp-Textgenerierung
  (PRD §21), analog zu `firstDown.ts`. 0 Punkte, keine Spielstand-Zeile.
- `pick.ts` – Pick-6-/Pick-2-Event-Konstruktion und WhatsApp-Textgenerierung (PRD §22/§23) als
  Varianten-Modul (analog zu `conversion.ts`). **Eigenständige Events – erzeugen niemals
  zusätzlich ein `INTERCEPTION`-Event.** Score ändert sich immer -> immer eine Spielstand-Zeile.
- `sack.ts` – Sack-spezifische Event-Konstruktion und WhatsApp-Textgenerierung (PRD §24), analog zu
  `interception.ts`. 0 Punkte, keine Spielstand-Zeile.
- `safety.ts` – Safety-/1-Punkt-Safety-Event-Konstruktion und WhatsApp-Textgenerierung (PRD
  §25/§26) als Varianten-Modul (analog zu `conversion.ts`/`pick.ts`). Score wird dem Team
  gutgeschrieben, das die Safety erzielt hat; Score ändert sich immer -> immer eine
  Spielstand-Zeile.
- `turnoverOnDowns.ts` – Turnover-on-Downs-spezifische Event-Konstruktion und
  WhatsApp-Textgenerierung (Erweiterung über die PRD hinaus, siehe Abschlussbericht), analog zu
  `interception.ts`/`sack.ts`. **NEGATIVE Statistik** (Korrektur ggü. einer früheren, falschen
  Interception-Analogie): `team` bezeichnet das Team, dessen Offense den Ball durch das
  Nicht-Erreichen des First Downs VERLIERT, nicht das Team, das dadurch in Ballbesitz kommt.
  Erfasst, anders als First Down/Interception/Sack, NIE einen Spieler, auch nicht beim eigenen
  Team (`eventValidation.ts` erzwingt das für beide Teams). 0 Punkte, keine Spielstand-Zeile, kein
  Einfluss auf `calculatePlayerStats()` (da nie eine `playerId` gesetzt wird).
- `teamStats.ts` – `calculateTeamStats(events)`: Team-Gesamtstatistik (Touchdowns/1-Pt
  Conversions/2-Pt Conversions/Interceptions/Turnover on Downs je Team, Erweiterung über die PRD
  hinaus). Bewusst ein eigenes Modul statt einer Erweiterung von `stats.ts`, um die bestehende
  Spielerstatistik-Berechnung unangetastet zu lassen. Rein aus den Events abgeleitet (PRD §35,
  Single Source of Truth) – keine redundante Speicherung, automatisch korrekt nach
  Bearbeiten/Löschen eines Events. Zählt nur erfolgreiche Conversions; `TOUCHDOWN_OPPONENT` zählt
  über `event.team` automatisch für den Gegner; Pick 6/Pick 2 fließen bewusst NICHT zusätzlich in
  `interceptions` ein (analog zu `stats.ts`). `turnoverOnDowns` ist eine NEGATIVE Statistik – siehe
  `turnoverOnDowns.ts`.
- `liveTicker.ts` – `buildTickerEntries(events, opponentName, getPlayer)`/`recentTickerEntries(entries, limit)`:
  eigene, kompakte Darstellung für Liveticker (PRD §39) und "Letzte Events" (PRD §36). Bewusst
  KEINE Wiederverwendung der `format*Message`-WhatsApp-Texte – eigene Formatierung ohne "Neuer
  Spielstand:"-Zeilen (Scoring-Events zeigen im Ticker keinen Score, nur Halbzeit/Weiter
  geht's/2-Minuten-Warnung/Spielende zeigen den zum jeweiligen Zeitpunkt gültigen laufenden
  Spielstand). "Letzte Events" leitet sich aus denselben Einträgen ab wie der vollständige
  Liveticker – keine zweite Datenquelle.
- `eventEditing.ts` – `getEventEditKind(event)`/`canEditEvent(game, event)`/`canDeleteEvent(game, event)`
  (PRD §41/§42): bestimmt je Event-Typ, ob und welche Bearbeiten-UI zutrifft
  (`single-player`/`passing`/`conversion`), sowie ob Bearbeiten/Löschen für ein Event im aktuellen
  Spielstatus erlaubt ist. Bearbeiten/Löschen ist ausschließlich bei `Game.status === FINAL`
  möglich (PRD §41 wörtlich: "Abgeschlossene Spiele können nachträglich bearbeitet werden") und
  nie für die vier Steuerungs-Events (`HALFTIME`/`SECOND_HALF_START`/`TWO_MIN_WARNING`/`GAME_END`)
  – `Game.status` wird nicht aus ihnen abgeleitet, ein Löschen/Ändern würde Status und
  Event-Historie inkonsistent werden lassen. Bewusst keine generische Event-Engine: nur eine
  kleine, explizite Zuordnung der bekannten Event-Typen zu drei UI-Formen. `TURNOVER_ON_DOWNS`
  liefert für beide Teams `null` (kein editierbares Feld, da nie ein Spieler erfasst wird) – bleibt
  aber bei `FINAL` löschbar wie jedes andere Nicht-Steuerungs-Event.
- `backup.ts` – Backup-/Restore-Format und -Validierung (PRD §5). `BACKUP_SCHEMA_VERSION` (aktuell
  `1`), `buildBackup(players, games, events)` (reine Serialisierung + `exportedAt`-Zeitstempel),
  `buildBackupFilename(date)` (Dateiname für den Export) und `parseBackupJson(rawJson)` – parst und
  validiert ein Backup-JSON vollständig (JSON-Gültigkeit, Grundstruktur, Backup-Version,
  Pflichtfelder/Datentypen/Enum-Werte je Datensatz, eindeutige IDs, Beziehungen
  Event→Spiel/Event→Spieler) und wirft bei JEDEM Problem einen `Error`, bevor irgendetwas
  zurückgegeben wird – nie ein teilweise gültiges Ergebnis. Nutzt für die fachliche
  Kernvalidierung bewusst dieselben Validatoren wie die normale Datenerfassung
  (`assertValidPlayerInput`/`assertValidGameInput`/`assertValidEventInput`), keine zweite/parallele
  Validierungslogik.

Noch nicht enthalten (folgt in späteren Schritten): WhatsApp-Versand, eine generische
Event-Flow-Konfiguration für die UI.
