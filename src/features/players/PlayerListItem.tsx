import { Link } from 'react-router-dom';
import type { Player } from '../../domain/types';

interface PlayerListItemProps {
  player: Player;
  onToggleActive: (player: Player) => void;
  /** Zeigt an, ob die Aktivieren/Deaktivieren-Aktion gerade läuft (verhindert Doppelklicks). */
  isToggling: boolean;
}

/** Eine Zeile in der Spielerliste – für Touch-Bedienung großzügig dimensioniert. */
export function PlayerListItem({ player, onToggleActive, isToggling }: PlayerListItemProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-lg font-bold tabular-nums">
        {player.jerseyNumber}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">
          {player.firstName} {player.lastName}
        </p>
        <p className={player.active ? 'text-sm text-emerald-400' : 'text-sm text-slate-500'}>
          {player.active ? 'Aktiv' : 'Inaktiv'}
        </p>
      </div>

      <Link
        to={`/spieler/${player.id}/bearbeiten`}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
      >
        Bearbeiten
      </Link>

      <button
        type="button"
        onClick={() => onToggleActive(player)}
        disabled={isToggling}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
      >
        {player.active ? 'Deaktivieren' : 'Aktivieren'}
      </button>
    </li>
  );
}
