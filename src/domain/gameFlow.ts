import { EVENT_TYPE, GAME_STATUS } from './types';
import type { GameStatus, Half } from './types';
import type { Score } from './scoring';
import type { CreateEventInput } from './eventValidation';

/**
 * Steuerungslogik für den Spielablauf (Halbzeit → "Weiter geht's" →
 * 2-Minuten-Warnung → Spielende). Die Statusübergänge sind bewusst NICHT als
 * generische State-Machine-Abstraktion gebaut – nur einzelne, unabhängig
 * testbare Wächterfunktionen für genau die vier hier benötigten Übergänge,
 * analog zum bereits bestehenden `resolveCurrentHalf()`.
 *
 * Halbzeit, 2-Minuten-Warnung, "Weiter geht's" und Spielende werden – wie in
 * der PRD (§27–§31) vorgesehen – jeweils als eigenes `GameEvent` gespeichert
 * (Typen `HALFTIME`/`TWO_MIN_WARNING`/`SECOND_HALF_START`/`GAME_END`, siehe
 * `types.ts`/`CONTROL_EVENT_TYPES`). Diese Steuerungs-Events haben immer
 * `team: null` und `points: 0` und fließen daher NIE in `calculateScore()`
 * oder `calculatePlayerStats()` ein (beide summieren/filtern ausschließlich
 * über `team` bzw. konkrete Spieler-/Team-bezogene Eventtypen) – siehe
 * `scoring.ts`/`stats.ts`.
 */

/** Ob während des aktuellen Status Spielereignisse erfasst werden dürfen. */
export function canRecordEvents(status: GameStatus): boolean {
  return status === GAME_STATUS.LIVE_FIRST_HALF || status === GAME_STATUS.LIVE_SECOND_HALF;
}

/** Halbzeit ist nur während der ersten Halbzeit auslösbar. */
export function canStartHalftime(status: GameStatus): boolean {
  return status === GAME_STATUS.LIVE_FIRST_HALF;
}

/** "Weiter geht's" ist nur während der Halbzeitpause auslösbar. */
export function canResumeSecondHalf(status: GameStatus): boolean {
  return status === GAME_STATUS.HALFTIME;
}

/** Spielende ist nur während der zweiten Halbzeit auslösbar. */
export function canFinishGame(status: GameStatus): boolean {
  return status === GAME_STATUS.LIVE_SECOND_HALF;
}

/**
 * 2-Minuten-Warnung ist während jeder laufenden Halbzeit auslösbar, nicht
 * aber während der Halbzeitpause oder nach Spielende.
 */
export function canTriggerTwoMinuteWarning(status: GameStatus): boolean {
  return status === GAME_STATUS.LIVE_FIRST_HALF || status === GAME_STATUS.LIVE_SECOND_HALF;
}

// ---------------------------------------------------------------------------
// Event-Konstruktion (PRD §27, §28, §30, §31)
// ---------------------------------------------------------------------------

export interface BuildHalftimeEventInput {
  gameId: string;
  half: Half;
}

/** PRD §28: "Event `HALFTIME` speichern". Kein Score-/Statistik-Einfluss. */
export function buildHalftimeEvent(input: BuildHalftimeEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.HALFTIME,
    team: null,
    points: 0,
    half: input.half,
  };
}

export interface BuildSecondHalfStartEventInput {
  gameId: string;
  half: Half;
}

/** PRD §30: "Event `SECOND_HALF_START` speichern". Kein Score-/Statistik-Einfluss. */
export function buildSecondHalfStartEvent(input: BuildSecondHalfStartEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.SECOND_HALF_START,
    team: null,
    points: 0,
    half: input.half,
  };
}

export interface BuildTwoMinuteWarningEventInput {
  gameId: string;
  half: Half;
}

/** PRD §27: "Event speichern". Kein Score-/Statistik-Einfluss, beliebig oft wiederholbar. */
export function buildTwoMinuteWarningEvent(
  input: BuildTwoMinuteWarningEventInput,
): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.TWO_MIN_WARNING,
    team: null,
    points: 0,
    half: input.half,
  };
}

export interface BuildGameEndEventInput {
  gameId: string;
  half: Half;
}

/** PRD §31: "Event `GAME_END` speichern". Kein Score-/Statistik-Einfluss. */
export function buildGameEndEvent(input: BuildGameEndEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.GAME_END,
    team: null,
    points: 0,
    half: input.half,
  };
}

// ---------------------------------------------------------------------------
// WhatsApp-Nachrichten
// ---------------------------------------------------------------------------

export interface GameFlowMessageInput {
  opponentName: string;
  score: Score;
}

/**
 * WhatsApp-Text für die Halbzeit (PRD §28). Wortlaut exakt aus der PRD
 * übernommen: `Halbzeit\nRegensburg Phoenix X:Y Gegner` – dasselbe
 * "Team X:Y Team"-Format wie bei "Weiter geht's"/Spielende, kein
 * "Spielstand:"-Präfix.
 */
export function formatHalftimeMessage(input: GameFlowMessageInput): string {
  return `Halbzeit\nRegensburg Phoenix ${input.score.phoenix}:${input.score.opponent} ${input.opponentName}`;
}

/**
 * WhatsApp-Text für die 2-Minuten-Warnung (PRD §27). Wortlaut exakt aus der
 * PRD übernommen: `2-Minuten-Warnung\nSpielstand: X:Y`.
 */
export function formatTwoMinuteWarningMessage(input: Pick<GameFlowMessageInput, 'score'>): string {
  return `2-Minuten-Warnung\nSpielstand: ${input.score.phoenix}:${input.score.opponent}`;
}

/**
 * WhatsApp-Text für "Weiter geht's" (PRD §30). Wortlaut exakt aus der PRD
 * übernommen: `Weiter geht's\nRegensburg Phoenix X:Y Gegner`.
 */
export function formatSecondHalfStartMessage(input: GameFlowMessageInput): string {
  return `Weiter geht's\nRegensburg Phoenix ${input.score.phoenix}:${input.score.opponent} ${input.opponentName}`;
}

/**
 * WhatsApp-Text für das Spielende (PRD §31). Wortlaut exakt aus der PRD
 * übernommen: `Spielende\nRegensburg Phoenix X:Y Gegner`.
 */
export function formatGameEndMessage(input: GameFlowMessageInput): string {
  return `Spielende\nRegensburg Phoenix ${input.score.phoenix}:${input.score.opponent} ${input.opponentName}`;
}
