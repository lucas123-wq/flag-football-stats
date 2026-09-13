import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { EventType, Half, Team } from './types';
import type { Score } from './scoring';

/**
 * Pick-6-/Pick-2-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung), analog zu `conversion.ts` (Varianten-Modul für
 * zwei eng verwandte Eventtypen). Bewusst NICHT als generische "Event
 * Engine" gebaut.
 *
 * WICHTIG (PRD §22/§23): Pick 6 und Pick 2 sind EIGENSTÄNDIGE Events und
 * erzeugen NIEMALS zusätzlich ein `INTERCEPTION`-Event.
 */

export type PickVariant = 'SIX' | 'TWO';

const PICK_POINTS: Record<PickVariant, number> = { SIX: 6, TWO: 2 };
const PICK_EVENT_TYPE: Record<PickVariant, EventType> = {
  SIX: EVENT_TYPE.PICK_6,
  TWO: EVENT_TYPE.PICK_2,
};
const PICK_LABEL: Record<PickVariant, string> = { SIX: 'Pick 6', TWO: 'Pick 2' };

export interface BuildPickEventInput {
  gameId: string;
  half: Half;
  variant: PickVariant;
  team: Team;
  /** Nur bei `team === TEAM.PHOENIX` relevant. */
  scorerId?: string;
}

export function buildPickEvent(input: BuildPickEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: PICK_EVENT_TYPE[input.variant],
    team: input.team,
    playerId: input.team === TEAM.PHOENIX ? (input.scorerId ?? null) : null,
    points: PICK_POINTS[input.variant],
    half: input.half,
  };
}

export interface PickMessageInput {
  variant: PickVariant;
  team: Team;
  opponentName: string;
  /** Nur bei eigenem Pick 6/Pick 2. */
  scorerLabel?: string;
  /** Spielstand NACH diesem Event (PRD §22/§23 – Score ändert sich immer). */
  scoreAfter: Score;
}

/** WhatsApp-Text (PRD §22/§23). Score ändert sich immer -> immer eine Spielstand-Zeile. */
export function formatPickMessage(input: PickMessageInput): string {
  const label = PICK_LABEL[input.variant];
  const scoreLine = `Neuer Spielstand: ${input.scoreAfter.phoenix}:${input.scoreAfter.opponent}`;

  if (input.team === TEAM.OPPONENT) {
    return `${label} ${input.opponentName}\n${scoreLine}`;
  }
  return `${label} Regensburg Phoenix ${input.scorerLabel}\n${scoreLine}`;
}
