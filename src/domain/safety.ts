import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { EventType, Half, Team } from './types';
import type { Score } from './scoring';

/**
 * Safety-/1-Punkt-Safety-spezifische, reine Domain-Logik (Event-Konstruktion
 * + WhatsApp-Textgenerierung), analog zu `conversion.ts`/`pick.ts`
 * (Varianten-Modul für zwei eng verwandte Eventtypen). Bewusst NICHT als
 * generische "Event Engine" gebaut.
 *
 * Punkte/Statistik/Nachricht gemäß PRD §25/§26: Der Score wird immer dem
 * Team gutgeschrieben, das die Safety erzielt hat (eigenes Team = eigener
 * Spieler + eigene Punkte; Gegner = keine Spielerauswahl + gegnerische
 * Punkte) – exakt dasselbe Muster wie bei Pick 6/Pick 2/Interception/Sack.
 */

export type SafetyVariant = 'SAFETY' | 'SAFETY_1PT';

const SAFETY_POINTS: Record<SafetyVariant, number> = { SAFETY: 2, SAFETY_1PT: 1 };
const SAFETY_EVENT_TYPE: Record<SafetyVariant, EventType> = {
  SAFETY: EVENT_TYPE.SAFETY,
  SAFETY_1PT: EVENT_TYPE.SAFETY_1PT,
};
const SAFETY_LABEL: Record<SafetyVariant, string> = {
  SAFETY: 'Safety',
  SAFETY_1PT: '1 Pt Safety',
};

export interface BuildSafetyEventInput {
  gameId: string;
  half: Half;
  variant: SafetyVariant;
  team: Team;
  /** Nur bei `team === TEAM.PHOENIX` relevant. */
  scorerId?: string;
}

export function buildSafetyEvent(input: BuildSafetyEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: SAFETY_EVENT_TYPE[input.variant],
    team: input.team,
    playerId: input.team === TEAM.PHOENIX ? (input.scorerId ?? null) : null,
    points: SAFETY_POINTS[input.variant],
    half: input.half,
  };
}

export interface SafetyMessageInput {
  variant: SafetyVariant;
  team: Team;
  opponentName: string;
  /** Nur bei eigener Safety. */
  scorerLabel?: string;
  /** Spielstand NACH diesem Event (PRD §25/§26 – Score ändert sich immer). */
  scoreAfter: Score;
}

/** WhatsApp-Text (PRD §25/§26). Score ändert sich immer -> immer eine Spielstand-Zeile. */
export function formatSafetyMessage(input: SafetyMessageInput): string {
  const label = SAFETY_LABEL[input.variant];
  const scoreLine = `Neuer Spielstand: ${input.scoreAfter.phoenix}:${input.scoreAfter.opponent}`;

  if (input.team === TEAM.OPPONENT) {
    return `${label} ${input.opponentName}\n${scoreLine}`;
  }
  return `${label} Regensburg Phoenix ${input.scorerLabel}\n${scoreLine}`;
}
