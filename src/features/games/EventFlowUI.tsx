import type { ReactNode } from 'react';
import { formatPlayerLabel } from '../../domain/touchdown';
import type { Player } from '../../domain/types';

/**
 * Gemeinsame, rein präsentationale Bausteine für Event-Flows (Touchdown,
 * Conversion, …). Enthält bewusst KEINE Event-spezifische Logik – nur
 * Layout/Darstellung, um Duplikation zwischen den einzelnen Flow-Komponenten
 * zu vermeiden. Keine generische "Event Engine".
 */

interface FlowOverlayProps {
  title: string;
  onCancel: () => void;
  error: string | null;
  children: ReactNode;
}

/** Vollflächiges Overlay mit Titel, Abbrechen-Button und Fehleranzeige. */
export function FlowOverlay({ title, onCancel, error, children }: FlowOverlayProps) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 pb-24 pt-6 text-slate-50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
          >
            Abbrechen
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}

interface PlayerPickerProps {
  prompt: string;
  players: Player[];
  onSelect: (player: Player) => void;
}

/** Liste aktiver Spieler zur Auswahl (Trikotnummer + Name), große Touch-Ziele. */
export function PlayerPicker({ prompt, players, onSelect }: PlayerPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-slate-300">{prompt}</p>
      {players.length === 0 ? (
        <p className="text-sm text-slate-500">
          Keine aktiven Spieler vorhanden. Bitte zuerst einen Spieler anlegen.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onSelect(player)}
                className="w-full rounded-xl bg-slate-800 px-4 py-4 text-left text-lg font-medium hover:bg-slate-700"
              >
                {formatPlayerLabel(player)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ConfirmViewProps {
  lines: string[];
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bestätigungsseite mit den zusammengefassten Vorgangszeilen (PRD §16). */
export function ConfirmView({ lines, isSaving, onConfirm, onCancel }: ConfirmViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-slate-900 px-4 py-6 text-center">
        {lines.map((line) => (
          <p key={line} className="text-lg font-semibold">
            {line}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSaving}
          className="rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400 disabled:opacity-50"
        >
          Bestätigen
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-xl bg-slate-800 px-4 py-4 text-lg font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
