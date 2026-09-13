import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../data/db';
import { formatGameDate, getGameStatusLabel } from './gameFormatting';
import { sortGamesByRecency } from './sortGames';

/** Spiele-Startseite (PRD §11): alle Spiele, neueste zuerst. */
export function GamesListPage() {
  const games = useLiveQuery(() => db.games.toArray(), []);
  const isLoading = games === undefined;
  const sorted = isLoading ? [] : sortGamesByRecency(games);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-950 px-4 pb-24 pt-6 text-slate-50">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Spiele</h1>
        <p className="text-sm text-slate-400">Regensburg Phoenix</p>
      </header>

      <Link
        to="/spiele/neu"
        className="flex items-center justify-center rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400"
      >
        + Neues Spiel
      </Link>

      {isLoading ? (
        <p className="text-slate-400">Lade Spiele…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Spiele vorhanden.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((game) => (
            <li key={game.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">vs. {game.opponent}</p>
                <p className="text-sm text-slate-400">
                  {formatGameDate(game.date)} · {getGameStatusLabel(game.status)}
                </p>
              </div>
              <Link
                to={`/spiele/${game.id}`}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
              >
                Öffnen
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
