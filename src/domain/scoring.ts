import { TEAM } from './types';
import type { GameEvent } from './types';

export interface Score {
  phoenix: number;
  opponent: number;
}

/**
 * Berechnet den aktuellen Spielstand ausschließlich aus den gespeicherten
 * Events (PRD §35, Single Source of Truth) – es gibt bewusst keinen
 * persistierten Score-Wert am `Game`-Datensatz. Reine Funktion: dieselben
 * Events ergeben immer denselben Score, unabhängig von Reihenfolge.
 *
 * Steuerungs-Events (`team === null`) tragen nicht zum Score bei.
 */
export function calculateScore(events: GameEvent[]): Score {
  let phoenix = 0;
  let opponent = 0;

  for (const event of events) {
    if (event.team === TEAM.PHOENIX) {
      phoenix += event.points;
    } else if (event.team === TEAM.OPPONENT) {
      opponent += event.points;
    }
  }

  return { phoenix, opponent };
}
