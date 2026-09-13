import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { Half, Player, Team } from './types';
import type { Score } from './scoring';

/**
 * Touchdown-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung). Bewusst NICHT als generische "Event Engine" für
 * beliebige Eventtypen gebaut – nur für Touchdown (Schritt 6).
 */

export type TouchdownVariant = 'RUSHING' | 'PASSING';

/** Punkte für einen Touchdown, eigen oder gegnerisch (PRD §33). */
export const TOUCHDOWN_POINTS = 6;

/** Formatiert einen Spieler wie in der PRD üblich: "#12 Max Mustermann". */
export function formatPlayerLabel(player: Player): string {
  return `#${player.jerseyNumber} ${player.firstName} ${player.lastName}`;
}

export interface BuildRushingTouchdownEventInput {
  gameId: string;
  half: Half;
  scorerId: string;
}

export function buildRushingTouchdownEvent(
  input: BuildRushingTouchdownEventInput,
): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.TOUCHDOWN_RUSHING,
    team: TEAM.PHOENIX,
    playerId: input.scorerId,
    points: TOUCHDOWN_POINTS,
    half: input.half,
  };
}

export interface BuildPassingTouchdownEventInput {
  gameId: string;
  half: Half;
  qbId: string;
  receiverId: string;
}

export function buildPassingTouchdownEvent(
  input: BuildPassingTouchdownEventInput,
): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.TOUCHDOWN_PASSING,
    team: TEAM.PHOENIX,
    qbId: input.qbId,
    receiverId: input.receiverId,
    points: TOUCHDOWN_POINTS,
    half: input.half,
  };
}

export interface BuildOpponentTouchdownEventInput {
  gameId: string;
  half: Half;
}

export function buildOpponentTouchdownEvent(
  input: BuildOpponentTouchdownEventInput,
): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
    team: TEAM.OPPONENT,
    points: TOUCHDOWN_POINTS,
    half: input.half,
  };
}

export interface TouchdownMessageInput {
  team: Team;
  opponentName: string;
  /** Nur bei `team === TEAM.PHOENIX` relevant. */
  variant?: TouchdownVariant;
  /** Nur bei Rushing. */
  scorerLabel?: string;
  /** Nur bei Passing. */
  qbLabel?: string;
  receiverLabel?: string;
  /** Spielstand NACH diesem Event (PRD §17: "Neuer Spielstand: …"). */
  scoreAfter: Score;
}

/**
 * Erzeugt den WhatsApp-fertigen Text für ein Touchdown-Event (PRD §17.2/
 * §17.3). Reine Funktion, keine Zwischenablage/kein Versand – das übernimmt
 * die UI.
 */
export function formatTouchdownMessage(input: TouchdownMessageInput): string {
  const scoreLine = `Neuer Spielstand: ${input.scoreAfter.phoenix}:${input.scoreAfter.opponent}`;

  if (input.team === TEAM.OPPONENT) {
    return `Touchdown ${input.opponentName}\n${scoreLine}`;
  }

  if (input.variant === 'PASSING') {
    return `Touchdown Regensburg Phoenix ${input.qbLabel} -> ${input.receiverLabel}\n${scoreLine}`;
  }

  return `Touchdown Regensburg Phoenix ${input.scorerLabel}\n${scoreLine}`;
}
