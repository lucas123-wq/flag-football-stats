import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { Half, Team } from './types';

/**
 * First-Down-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung). Bewusst NICHT als generische "Event Engine" für
 * beliebige Eventtypen gebaut – nur für First Down (Schritt 8), analog zu
 * `touchdown.ts`/`conversion.ts`.
 *
 * First Down unterscheidet laut PRD §20 nicht zwischen Rushing/Passing –
 * es gibt daher keine Variante, nur den erzielenden Spieler (eigenes Team)
 * bzw. gar keinen Spieler (Gegner).
 */

export interface BuildFirstDownEventInput {
  gameId: string;
  half: Half;
  team: Team;
  /** Nur bei `team === TEAM.PHOENIX` relevant. */
  scorerId?: string;
}

/** Ein First Down verändert den Score nie (PRD §33: 0 Punkte). */
export function buildFirstDownEvent(input: BuildFirstDownEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.FIRST_DOWN,
    team: input.team,
    playerId: input.team === TEAM.PHOENIX ? (input.scorerId ?? null) : null,
    points: 0,
    half: input.half,
  };
}

export interface FirstDownMessageInput {
  team: Team;
  opponentName: string;
  /** Nur bei eigenem First Down. */
  scorerLabel?: string;
}

/**
 * Erzeugt den WhatsApp-fertigen Text für ein First-Down-Event (PRD §20).
 *
 * Der Spielstand wird laut Produktregel nur mitgesendet, wenn sich der
 * Score durch das Event tatsächlich ändert. Ein First Down ändert den Score
 * nie – die Nachricht enthält deshalb bewusst KEINE Spielstand-Zeile (im
 * Unterschied zu Touchdown/Conversion, die den Score verändern können).
 */
export function formatFirstDownMessage(input: FirstDownMessageInput): string {
  if (input.team === TEAM.OPPONENT) {
    return `First Down ${input.opponentName}`;
  }

  return `First Down Regensburg Phoenix ${input.scorerLabel}`;
}
