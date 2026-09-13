import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { Half, Team } from './types';

/**
 * Interception-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung), analog zu `firstDown.ts`. Bewusst NICHT als
 * generische "Event Engine" gebaut. Eine Interception verändert den Score
 * nie (PRD §21) – Pick 6/Pick 2 sind eigenständige Events (siehe `pick.ts`)
 * und werden hier bewusst NICHT miterzeugt.
 */

export interface BuildInterceptionEventInput {
  gameId: string;
  half: Half;
  team: Team;
  /** Nur bei `team === TEAM.PHOENIX` relevant. */
  scorerId?: string;
}

export function buildInterceptionEvent(input: BuildInterceptionEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.INTERCEPTION,
    team: input.team,
    playerId: input.team === TEAM.PHOENIX ? (input.scorerId ?? null) : null,
    points: 0,
    half: input.half,
  };
}

export interface InterceptionMessageInput {
  team: Team;
  opponentName: string;
  /** Nur bei eigener Interception. */
  scorerLabel?: string;
}

/**
 * WhatsApp-Text (PRD §21). Score ändert sich nie -> keine Spielstand-Zeile.
 */
export function formatInterceptionMessage(input: InterceptionMessageInput): string {
  if (input.team === TEAM.OPPONENT) {
    return `Interception ${input.opponentName}`;
  }
  return `Interception Regensburg Phoenix ${input.scorerLabel}`;
}
