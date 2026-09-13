import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportBackup, restoreBackup, triggerBackupDownload } from '../../data/backup';
import { clearAllData } from '../../data/db';
import { buildBackupFilename, parseBackupJson } from '../../domain/backup';
import type { BackupFile } from '../../domain/backup';

/** Formatiert `exportedAt` (ISO-Datetime) für die Import-Vorschau. */
function formatBackupTimestamp(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Einstellungen (PRD §45).
 *
 * - "Daten exportieren"/"Daten importieren" (PRD §5): vollständiger,
 *   versionierter Export/Import der lokalen Datenbasis (Spieler, Spiele,
 *   Events) – siehe `domain/backup.ts` (Format + Validierung) und
 *   `data/backup.ts` (Lesen/Schreiben der Dexie-Datenbank, Datei-Download).
 *   Komplett lokal/offline, keine Serveranfrage.
 * - "Alle Daten löschen" (unverändert seit dem vorherigen Schritt).
 * - "App-Version" zeigt die aus `package.json` injizierte Versionsnummer
 *   (siehe `vite.config.ts`/`__APP_VERSION__`).
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'Alle Daten löschen?\n\nDabei werden alle Spieler, Spiele und Events dauerhaft vom Gerät gelöscht.',
    );
    if (!confirmed) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await clearAllData();
      navigate('/spiele');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const json = await exportBackup();
      triggerBackupDownload(json, buildBackupFilename(new Date()));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Erlaubt die erneute Auswahl derselben Datei (z. B. nach einem Fehler).
    event.target.value = '';
    if (!file) {
      return;
    }
    setImportError(null);
    setImportSuccess(null);
    setPendingBackup(null);
    try {
      const text = await file.text();
      const backup = parseBackupJson(text);
      setPendingBackup(backup);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Backup konnte nicht gelesen werden.');
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup) {
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      await restoreBackup(pendingBackup);
      setImportSuccess(
        `Backup erfolgreich importiert: ${pendingBackup.players.length} Spieler, ${pendingBackup.games.length} Spiele, ${pendingBackup.events.length} Events wiederhergestellt.`,
      );
      setPendingBackup(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelImport = () => {
    setPendingBackup(null);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-950 px-4 pb-24 pt-6 text-slate-50">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase text-slate-400">Daten</h2>

        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="rounded-xl bg-slate-800 px-4 py-4 text-lg font-semibold text-slate-50 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Daten exportieren
        </button>
        {exportError && (
          <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            {exportError}
          </p>
        )}

        <button
          type="button"
          onClick={handleImportButtonClick}
          disabled={isImporting}
          className="rounded-xl bg-slate-800 px-4 py-4 text-lg font-semibold text-slate-50 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Daten importieren
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelected}
          className="hidden"
          aria-label="Backup-Datei auswählen"
        />

        {importError && (
          <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            {importError}
          </p>
        )}
        {importSuccess && (
          <p className="rounded-lg bg-slate-900 px-4 py-3 text-sm text-emerald-300">
            {importSuccess}
          </p>
        )}

        {pendingBackup && (
          <section className="flex flex-col gap-3 rounded-xl bg-slate-900 px-4 py-4">
            <h3 className="text-base font-semibold">Backup gefunden</h3>
            <dl className="flex flex-col gap-1 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <dt>Spieler</dt>
                <dd className="tabular-nums text-slate-100">{pendingBackup.players.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Spiele</dt>
                <dd className="tabular-nums text-slate-100">{pendingBackup.games.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Events</dt>
                <dd className="tabular-nums text-slate-100">{pendingBackup.events.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Erstellt am</dt>
                <dd className="text-slate-100">
                  {formatBackupTimestamp(pendingBackup.exportedAt)}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-red-300">
              Der aktuelle Datenbestand (alle Spieler, Spiele und Events) wird dabei vollständig
              ersetzt.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="rounded-xl bg-red-950 px-4 py-4 text-lg font-medium text-red-300 hover:bg-red-900 disabled:opacity-50"
              >
                Jetzt importieren
              </button>
              <button
                type="button"
                onClick={handleCancelImport}
                disabled={isImporting}
                className="rounded-xl bg-slate-800 px-4 py-4 text-lg font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
          </section>
        )}
      </section>

      {deleteError && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {deleteError}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase text-slate-400">Alle Daten löschen</h2>
        <p className="text-sm text-slate-400">
          Dabei werden alle Spieler, Spiele und Events dauerhaft vom Gerät gelöscht.
        </p>
        <button
          type="button"
          onClick={handleDeleteAllData}
          disabled={isDeleting}
          className="rounded-xl bg-red-950 px-4 py-4 text-lg font-medium text-red-300 hover:bg-red-900 disabled:opacity-50"
        >
          Alle Daten löschen
        </button>
      </section>

      <p className="text-center text-xs text-slate-500">App-Version {__APP_VERSION__}</p>
    </div>
  );
}
