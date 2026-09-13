import type { GameEvent } from '../../domain/types';
import type { TickerEntry } from '../../domain/liveTicker';

interface EventTickerProps {
  entries: TickerEntry[];
  emptyMessage: string;
  canEdit: (event: GameEvent) => boolean;
  canDelete: (event: GameEvent) => boolean;
  onEdit: (event: GameEvent) => void;
  onDelete: (event: GameEvent) => void;
  isBusy: boolean;
}

/**
 * Rein präsentationale Liste von Ticker-Einträgen (PRD §36 "Letzte Events"
 * und §39 Liveticker teilen sich diese eine Komponente – siehe
 * `domain/liveTicker.ts`, keine zweite Datenquelle/Darstellung). Bearbeiten-/
 * Löschen-Buttons werden nur gerendert, wenn `canEdit`/`canDelete` für das
 * jeweilige Event `true` liefern (siehe `domain/eventEditing.ts`) – bei
 * Steuerungs-Events sowie außerhalb von `FINAL` erscheint keiner der beiden
 * Buttons.
 */
export function EventTicker({
  entries,
  emptyMessage,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isBusy,
}: EventTickerProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map(({ event, title, detail }) => (
        <li
          key={event.id}
          data-testid={`ticker-entry-${event.id}`}
          className="flex flex-col gap-1 rounded-lg bg-slate-900 px-4 py-3 text-sm text-slate-100"
        >
          <p className="font-semibold">{title}</p>
          {detail && <p className="text-slate-300">{detail}</p>}
          {(canEdit(event) || canDelete(event)) && (
            <div className="mt-1 flex gap-2">
              {canEdit(event) && (
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  disabled={isBusy}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  Bearbeiten
                </button>
              )}
              {canDelete(event) && (
                <button
                  type="button"
                  onClick={() => onDelete(event)}
                  disabled={isBusy}
                  className="rounded-lg bg-red-950 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900 disabled:opacity-50"
                >
                  Löschen
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
