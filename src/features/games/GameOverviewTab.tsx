import { EventTicker } from './EventTicker';
import type { TickerEntry } from '../../domain/liveTicker';

interface GameOverviewTabProps {
  recentEntries: TickerEntry[];
}

/**
 * Spielübersicht (PRD §38). Gegner, Datum, Heimteam Regensburg Phoenix,
 * Status und Spielstand werden bereits im gemeinsamen Kopfbereich von
 * `GameDetailPage` angezeigt (`Scoreboard`, `GameStatusBadge`, Datum) – hier
 * bewusst NICHT dupliziert. Diese Ansicht zeigt ausschließlich die
 * "Letzte Events"-Zusammenfassung (PRD §36), abgeleitet aus denselben
 * Ticker-Daten wie die Tabs LIVETICKER/BEARBEITEN (keine zweite
 * Datenquelle/Darstellung) – schreibgeschützt, da Bearbeiten/Löschen dem
 * eigenen BEARBEITEN-Tab vorbehalten bleibt.
 */
export function GameOverviewTab({ recentEntries }: GameOverviewTabProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase text-slate-400">Letzte Events</h2>
      <EventTicker
        entries={recentEntries}
        emptyMessage="Noch keine Events erfasst."
        canEdit={() => false}
        canDelete={() => false}
        onEdit={() => {}}
        onDelete={() => {}}
        isBusy={false}
      />
    </section>
  );
}
