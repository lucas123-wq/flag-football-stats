import { EVENT_TYPE, TEAM } from './types';
import type { CreateEventInput } from './eventValidation';
import type { Half, Team } from './types';

/**
 * Turnover-on-Downs-spezifische, reine Domain-Logik (Event-Konstruktion +
 * WhatsApp-Textgenerierung), analog zu `interception.ts`/`firstDown.ts`/
 * `sack.ts`. Bewusst NICHT als generische "Event Engine" gebaut.
 *
 * WICHTIG (Korrektur): Turnover on Downs ist – anders als Interception –
 * eine NEGATIVE Teamstatistik. `team` bezeichnet das Team, das den Ball
 * durch das Nicht-Erreichen des First Downs VERLIERT (die eigene Offense
 * scheitert), nicht das Team, das den Ball dadurch bekommt. Beispiel:
 * Scheitert die eigene Offense (Regensburg Phoenix) an einem First Down,
 * wird `team: TEAM.PHOENIX` gespeichert und in der Teamstatistik
 * `phoenix.turnoverOnDowns` erhöht – NICHT `opponent.turnoverOnDowns`, obwohl
 * der Gegner dadurch in Ballbesitz kommt. Anders als bei Interception/First
 * Down/Sack wird HIER aber NIE ein Spieler erfasst, auch nicht beim eigenen
 * Team ("kein Spieler wird ausgewählt") – siehe `eventValidation.ts`, das
 * dies für beide Teams erzwingt. 0 Punkte, keine Score-Änderung, keine
 * Auswirkung auf `calculatePlayerStats()` (die dort nie referenzierte
 * `playerId` bleibt immer `null`).
 */

export interface BuildTurnoverOnDownsEventInput {
  gameId: string;
  half: Half;
  /** Das Team, dessen Offense den Ball durch den Turnover on Downs verliert. */
  team: Team;
}

/** Turnover on Downs ändert den Score nie (0 Punkte). */
export function buildTurnoverOnDownsEvent(input: BuildTurnoverOnDownsEventInput): CreateEventInput {
  return {
    gameId: input.gameId,
    type: EVENT_TYPE.TURNOVER_ON_DOWNS,
    team: input.team,
    points: 0,
    half: input.half,
  };
}

export interface TurnoverOnDownsMessageInput {
  /** Das Team, dessen Offense den Ball verliert (siehe Modul-Kommentar oben). */
  team: Team;
  opponentName: string;
}

/**
 * WhatsApp-Text: `Turnover on Downs Regensburg Phoenix` bzw.
 * `Turnover on Downs <Gegnername>` – nennt das Team, das den Ball verliert.
 * Score ändert sich nie -> keine Spielstand-Zeile, wie bei
 * First Down/Interception/Sack.
 */
export function formatTurnoverOnDownsMessage(input: TurnoverOnDownsMessageInput): string {
  const teamName = input.team === TEAM.PHOENIX ? 'Regensburg Phoenix' : input.opponentName;
  return `Turnover on Downs ${teamName}`;
}
