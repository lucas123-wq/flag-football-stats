import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { Half, Team } from './types';
import type { Score } from './scoring';

/**
 * Conversion-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung). Bewusst NICHT als generische "Event Engine" für
 * beliebige Eventtypen gebaut – nur für 1-/2-Punkt-Conversion (Schritt 7),
 * analog zu `touchdown.ts`.
 */

export type ConversionType = '1PT' | '2PT';

/** Punkte bei Erfolg (PRD §33). Bei Misserfolg immer 0. */
const CONVERSION_POINTS: Record<ConversionType, number> = { '1PT': 1, '2PT': 2 };

/** PRD-Wortlaut aus §18/§19: "1 Pt Conversion"/"2 Pt Conversion" (WhatsApp-Text). */
const CONVERSION_LABEL: Record<ConversionType, string> = {
  '1PT': '1 Pt Conversion',
  '2PT': '2 Pt Conversion',
};

export interface BuildConversionEventInput {
  gameId: string;
  half: Half;
  conversionType: ConversionType;
  team: Team;
  successful: boolean;
  /** Nur bei `team === TEAM.PHOENIX && successful === true` relevant. */
  scorerId?: string;
}

export function buildConversionEvent(input: BuildConversionEventInput): CreateEventInput {
  const usesScorer = input.team === TEAM.PHOENIX && input.successful;
  return {
    gameId: input.gameId,
    type: input.conversionType === '1PT' ? EVENT_TYPE.CONVERSION_1PT : EVENT_TYPE.CONVERSION_2PT,
    team: input.team,
    playerId: usesScorer ? (input.scorerId ?? null) : null,
    successful: input.successful,
    points: input.successful ? CONVERSION_POINTS[input.conversionType] : 0,
    half: input.half,
  };
}

export interface ConversionMessageInput {
  conversionType: ConversionType;
  team: Team;
  opponentName: string;
  successful: boolean;
  /** Nur bei eigener erfolgreicher Conversion. */
  scorerLabel?: string;
  /** Spielstand NACH diesem Event (PRD §18/§19). */
  scoreAfter: Score;
}

/**
 * Erzeugt den WhatsApp-fertigen Text für ein Conversion-Event (PRD §18/§19).
 * Reine Funktion, keine Zwischenablage/kein Versand – das übernimmt die UI.
 *
 * Wortlaut exakt aus der PRD übernommen: bei einem Fehlschlag lautet die
 * Nachricht `<Label> <Team> – nicht gut` – EINZEILIG, ganz ohne Spielstand-
 * Zeile (§18/§19 zeigen für diesen Fall kein "Spielstand:"/"Neuer
 * Spielstand:" im Beispiel, da eine fehlgeschlagene Conversion den Score nie
 * ändert). Bei Erfolg ändert sich der Score immer -> immer eine "Neuer
 * Spielstand:"-Zeile.
 */
export function formatConversionMessage(input: ConversionMessageInput): string {
  const label = CONVERSION_LABEL[input.conversionType];
  const teamName = input.team === TEAM.PHOENIX ? 'Regensburg Phoenix' : input.opponentName;

  if (!input.successful) {
    return `${label} ${teamName} – nicht gut`;
  }

  const scoreLine = `Neuer Spielstand: ${input.scoreAfter.phoenix}:${input.scoreAfter.opponent}`;
  if (input.team === TEAM.PHOENIX) {
    return `${label} ${teamName} ${input.scorerLabel}\n${scoreLine}`;
  }

  return `${label} ${teamName}\n${scoreLine}`;
}
