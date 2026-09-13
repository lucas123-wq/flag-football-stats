import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../data/db';
import { updatePlayer } from '../../data/players';
import { PlayerListItem } from './PlayerListItem';
import type { Player } from '../../domain/types';

function sortByJerseyNumber(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
}

/** Kaderübersicht (PRD §9, §43): aktive und inaktive Spieler getrennt dargestellt. */
export function PlayersListPage() {
  const players = useLiveQuery(() => db.players.toArray(), []);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggleActive = async (player: Player) => {
    setToggleError(null);
    setTogglingId(player.id);
    try {
      await updatePlayer(player.id, { active: !player.active });
    } catch (error) {
      setToggleError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.');
    } finally {
      setTogglingId(null);
    }
  };

  const isLoading = players === undefined;
  const active = isLoading ? [] : sortByJerseyNumber(players.filter((p) => p.active));
  const inactive = isLoading ? [] : sortByJerseyNumber(players.filter((p) => !p.active));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-950 px-4 pb-24 pt-6 text-slate-50">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Spieler</h1>
        <p className="text-sm text-slate-400">Regensburg Phoenix Kader</p>
      </header>

      <Link
        to="/spieler/neu"
        className="flex items-center justify-center rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400"
      >
        + Spieler hinzufügen
      </Link>

      {toggleError && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {toggleError}
        </p>
      )}

      {isLoading ? (
        <p className="text-slate-400">Lade Spieler…</p>
      ) : (
        <>
          <section aria-labelledby="active-players-heading" className="flex flex-col gap-3">
            <h2
              id="active-players-heading"
              className="text-sm font-semibold uppercase text-slate-400"
            >
              Aktive Spieler
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine aktiven Spieler.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {active.map((player) => (
                  <PlayerListItem
                    key={player.id}
                    player={player}
                    onToggleActive={handleToggleActive}
                    isToggling={togglingId === player.id}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="inactive-players-heading" className="flex flex-col gap-3">
            <h2
              id="inactive-players-heading"
              className="text-sm font-semibold uppercase text-slate-400"
            >
              Inaktive Spieler
            </h2>
            {inactive.length === 0 ? (
              <p className="text-sm text-slate-500">Keine inaktiven Spieler.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {inactive.map((player) => (
                  <PlayerListItem
                    key={player.id}
                    player={player}
                    onToggleActive={handleToggleActive}
                    isToggling={togglingId === player.id}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
