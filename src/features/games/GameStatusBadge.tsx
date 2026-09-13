import { getLiveGameStatusLabel } from './gameFormatting';
import type { GameStatus } from '../../domain/types';

interface GameStatusBadgeProps {
  status: GameStatus;
}

/** Zeigt den aktuellen Spielstatus/die Halbzeit (PRD §13) als Badge an. */
export function GameStatusBadge({ status }: GameStatusBadgeProps) {
  return (
    <span className="inline-block self-center rounded-full bg-slate-800 px-4 py-1 text-sm font-medium text-slate-200">
      {getLiveGameStatusLabel(status)}
    </span>
  );
}
