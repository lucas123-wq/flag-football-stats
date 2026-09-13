# data

Lokale Datenschicht auf Basis von Dexie (IndexedDB).

- `db.ts` – Dexie-Schema (`players`, `games`, `events`) inkl. Indizes. `clearAllData()` (PRD §45
  "Alle Daten löschen"): leert alle drei Tabellen in einer gemeinsamen Transaktion – bewusst hier
  in der DB-Schicht statt in einem einzelnen Repository, da die Operation tabellenübergreifend ist
  (analog zu `games.ts#deleteGame`, das für ein einzelnes Spiel bereits Games+Events gemeinsam
  löscht).
- `players.ts` / `games.ts` / `events.ts` – Repository-Funktionen (CRUD) für die jeweilige
  Entität. Jede Repository-Funktion validiert vor dem Speichern gegen das passende
  `domain/*Validation.ts`-Modul. `events.ts` vergibt zusätzlich eine fortlaufende `sequence` je
  Spiel. `games.ts#deleteGame` löscht ein Spiel inklusive aller zugehörigen Events
  (über `events.ts#deleteEventsByGame`), damit keine verwaisten Events zurückbleiben.
- `backup.ts` – Backup-Export/-Import (PRD §5). `exportBackup()` liest Spieler/Spiele/Events und
  baut daraus den Backup-JSON-Text (`domain/backup.ts#buildBackup`). `restoreBackup(backup)`
  ersetzt die GESAMTE lokale Datenbasis durch ein bereits validiertes Backup (PRD §5 beschreibt
  Import als "Wiederherstellung" – kein Merge-Verhalten) – läuft vollständig in EINER
  Dexie-Transaktion (`clearAllData()` + drei `bulkAdd`-Aufrufe als verschachtelte Transaktion),
  sodass ein Fehler mitten im Import den gesamten Vorgang zurückrollt und der vorherige
  Datenbestand unverändert bleibt. `triggerBackupDownload(content, filename)` kapselt die
  Browser-Download-Mechanik (Blob + `<a download>`), damit `exportBackup`/`restoreBackup` ohne
  Browser-APIs testbar bleiben. Der Aufrufer (UI) MUSS das Backup vorher über
  `domain/backup.ts#parseBackupJson` validiert haben – `restoreBackup` validiert nicht erneut.
