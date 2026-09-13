import { useState } from 'react';
import { canDeleteEvent, canEditEvent } from '../../domain/eventEditing';
import type { TickerEntry } from '../../domain/liveTicker';
import type { Game, GameEvent, Player } from '../../domain/types';
import { EventTicker } from './EventTicker';
import { GameOverviewTab } from './GameOverviewTab';
import { GameStatsTab } from './GameStatsTab';

export type GameTabKey = 'uebersicht' | 'liveticker' | 'statistiken' | 'bearbeiten';

/** PRD §37: exakte Reihenfolge/Begriffe. */
const TABS: { key: GameTabKey; label: string }[] = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'liveticker', label: 'Liveticker' },
  { key: 'statistiken', label: 'Statistiken' },
  { key: 'bearbeiten', label: 'Bearbeiten' },
];

interface GameTabsProps {
  game: Game;
  events: GameEvent[];
  players: Player[];
  tickerEntries: TickerEntry[];
  recentEntries: TickerEntry[];
  isBusy: boolean;
  onEditEvent: (event: GameEvent) => void;
  onDeleteEvent: (event: GameEvent) => void;
  onDeleteGame: () => void;
}

/**
 * Tab-Struktur eines abgeschlossenen Spiels (PRD §37): ÜBERSICHT / LIVETICKER
 * / STATISTIKEN / BEARBEITEN, nur bei `Game.status === FINAL` erreichbar
 * (§37 wörtlich: "Ein abgeschlossenes Spiel kann geöffnet werden") – für
 * laufende Spiele bleibt der bestehende Live-Spielbildschirm unverändert
 * (siehe `GameDetailPage.tsx`).
 *
 * Lokaler Komponenten-State statt eigener Routen/Query-Parameter (keine neue
 * Routing-Architektur nötig): Reload zeigt daher immer wieder ÜBERSICHT als
 * Standardansicht.
 *
 * LIVETICKER (§39) und BEARBEITEN (§41) rendern beide dieselbe vollständige
 * `tickerEntries`-Liste über dieselbe `EventTicker`-Komponente – keine zweite
 * Datenquelle. Der einzige Unterschied: LIVETICKER ist rein lesend
 * (`canEdit`/`canDelete` liefern immer `false`), BEARBEITEN zeigt die
 * echten, unveränderten Regeln aus `domain/eventEditing.ts` (nur bei FINAL,
 * nie für die vier Steuerungs-Events). "Spiel löschen" ist Teil von
 * BEARBEITEN, da es sich um eine spielbezogene Bearbeitungsmöglichkeit
 * handelt.
 */
export function GameTabs({
  game,
  events,
  players,
  tickerEntries,
  recentEntries,
  isBusy,
  onEditEvent,
  onDeleteEvent,
  onDeleteGame,
}: GameTabsProps) {
  const [activeTab, setActiveTab] = useState<GameTabKey>('uebersicht');

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Spielansicht"
        className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-1 py-3 text-center text-xs font-semibold uppercase tracking-tight ${
              activeTab === tab.key
                ? 'bg-orange-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'uebersicht' && <GameOverviewTab recentEntries={recentEntries} />}

      {activeTab === 'liveticker' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase text-slate-400">Liveticker</h2>
          <EventTicker
            entries={tickerEntries}
            emptyMessage="Noch keine Events erfasst."
            canEdit={() => false}
            canDelete={() => false}
            onEdit={() => {}}
            onDelete={() => {}}
            isBusy={false}
          />
        </section>
      )}

      {activeTab === 'statistiken' && (
        <GameStatsTab events={events} players={players} opponentName={game.opponent} />
      )}

      {activeTab === 'bearbeiten' && (
        <section className="flex flex-col gap-4">
          <EventTicker
            entries={tickerEntries}
            emptyMessage="Noch keine Events erfasst."
            canEdit={(event) => canEditEvent(game, event)}
            canDelete={(event) => canDeleteEvent(game, event)}
            onEdit={onEditEvent}
            onDelete={onDeleteEvent}
            isBusy={isBusy}
          />
          <button
            type="button"
            onClick={onDeleteGame}
            disabled={isBusy}
            className="rounded-xl bg-red-950 px-4 py-4 text-lg font-medium text-red-300 hover:bg-red-900 disabled:opacity-50"
          >
            Spiel löschen
          </button>
        </section>
      )}
    </div>
  );
}
