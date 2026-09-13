import { clearAllData, db } from './db';
import { buildBackup } from '../domain/backup';
import type { BackupFile } from '../domain/backup';

/**
 * Liest die vollständige aktuelle Datenbasis (Spieler, Spiele, Events) und
 * baut daraus den Backup-JSON-Text (PRD §5). Enthält bewusst NUR die
 * dauerhaft gespeicherten Domain-Daten – keine UI-/Anzeigedaten.
 */
export async function exportBackup(): Promise<string> {
  const [players, games, events] = await Promise.all([
    db.players.toArray(),
    db.games.toArray(),
    db.events.toArray(),
  ]);
  const backup = buildBackup(players, games, events);
  return JSON.stringify(backup, null, 2);
}

/**
 * Ersetzt die gesamte lokale Datenbasis durch ein bereits validiertes Backup
 * (siehe `domain/backup.ts#parseBackupJson` – der Aufrufer MUSS das Backup
 * vorher validiert haben, diese Funktion validiert nicht erneut). PRD §5
 * beschreibt Import als "Wiederherstellung" eines gesicherten Zustands – der
 * bestehende Datenbestand wird daher vollständig ersetzt, nicht
 * zusammengeführt (kein Merge-Verhalten in der PRD vorgesehen).
 *
 * Läuft vollständig in EINER Dexie-Transaktion über alle drei Tabellen:
 * `clearAllData()` (Nested-Transaction, wird von Dexie automatisch in diese
 * Transaktion übernommen) + die drei `bulkAdd`-Aufrufe. Schlägt irgendein
 * Schritt fehl, bricht Dexie die gesamte Transaktion ab und der vorherige
 * Datenbestand bleibt unverändert erhalten (atomarer Import).
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.players, db.games, db.events, async () => {
    await clearAllData();
    await db.players.bulkAdd(backup.players);
    await db.games.bulkAdd(backup.games);
    await db.events.bulkAdd(backup.events);
  });
}

/**
 * Bietet den übergebenen Backup-Text als lokale Datei zum Speichern an
 * (Blob + `<a download>`, komplett offline/ohne Serveranfrage). Isoliert in
 * einer eigenen Funktion, damit die eigentliche Backup-/Restore-Logik ohne
 * Browser-Download-APIs testbar bleibt.
 */
export function triggerBackupDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
