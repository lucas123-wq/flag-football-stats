import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { Half, Team } from './types';

/**
 * Sack-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung), analog zu `interception.ts`/`firstDown.ts`.
 * Bewusst NICHT als generische "Event Engine" gebaut. Ein Sack verändert
 * den Score nie (PRD §24).
 */

export interface BuildSackEventInput {
  gameId: string;
  half: Half;
  team: Team;
  /** Nur bei `team === TEAM.PHOENIX` relevant. */
  scorerId?: string;
}

export function buildSackEvent(input: BuildSackEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.SACK,
    team: input.team,
    playerId: input.team === TEAM.PHOENIX ? (input.scorerId ?? null) : null,
    points: 0,
    half: input.half,
  };
}

export interface SackMessageInput {
  team: Team;
  opponentName: string;
  /** Nur bei eigenem Sack. */
  scorerLabel?: string;
}

/** WhatsApp-Text (PRD §24). Score ändert sich nie -> keine Spielstand-Zeile. */
export function formatSackMessage(input: SackMessageInput): string {
  if (input.team === TEAM.OPPONENT) {
    return `Sack ${input.opponentName}`;
  }
  return `Sack Regensburg Phoenix ${input.scorerLabel}`;
}
