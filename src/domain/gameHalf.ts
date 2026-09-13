import { GAME_STATUS, HALF } from './types';
import type { GameStatus, Half } from './types';

/**
 * Leitet die aktuell gültige Halbzeit aus dem Spielstatus ab, für die
 * Zuordnung neuer Events (`GameEvent.half`). Es gibt in diesem Schritt noch
 * keine eigene Halbzeitsteuerung (Halbzeit-Button, "Weiter geht's") – die
 * Ableitung basiert ausschließlich auf dem bereits vorhandenen
 * `GAME_STATUS` (Auftrag Schritt 6, §11).
 *
 * `HALFTIME` wird der ersten Halbzeit zugeordnet (das Ereignis fällt an
 * deren Ende); `FINAL` ist über die deaktivierten Event-Buttons in der
 * Praxis nicht erreichbar, wird defensiv aber ebenfalls der ersten Halbzeit
 * zugeordnet, sofern das Spiel nie `LIVE_SECOND_HALF` erreicht hat.
 */
export function resolveCurrentHalf(status: GameStatus): Half {
  return status === GAME_STATUS.LIVE_SECOND_HALF ? HALF.SECOND : HALF.FIRST;
}
