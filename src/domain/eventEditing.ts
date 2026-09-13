import { CONTROL_EVENT_TYPES, EVENT_TYPE, GAME_STATUS, TEAM } from './types';
import type { Game, GameEvent } from './types';

/**
 * Bestimmt, welche Bearbeiten-UI (falls überhaupt) für ein Event zutrifft
 * (PRD §41: Spieler/QB/Receiver/Conversion-Erfolg ändern). Bewusst NICHT als
 * generische Event-Engine gebaut – nur eine kleine, explizite Zuordnung der
 * bereits bekannten Event-Typen zu genau drei UI-Formen, die alle die
 * bestehenden Bausteine `PlayerPicker`/`ConfirmView`/`FlowOverlay`
 * wiederverwenden.
 *
 * - `single-player`: Rushing TD, First Down, Interception, Pick 6/2, Sack,
 *   Safety/1-Punkt-Safety – jeweils NUR beim eigenen Team (Regensburg
 *   Phoenix), da gegnerische Events laut PRD §8/§34 nie einen Spieler
 *   erfassen und damit kein editierbares Feld besitzen.
 * - `passing`: Touchdown Passing (immer eigenes Team) – QB und Receiver.
 * - `conversion`: 1-/2-Punkt-Conversion (beide Teams) – Erfolg, beim eigenen
 *   Team zusätzlich der Spieler bei Erfolg.
 *
 * Events ganz ohne editierbares Feld (`TOUCHDOWN_OPPONENT`, `TURNOVER_ON_DOWNS`
 * – für kein Team, siehe unten – sowie gegnerische First-Down/Interception/
 * Pick/Sack/Safety-Varianten) sowie alle vier Steuerungs-Events liefern
 * `null` – für sie gibt es keinen Bearbeiten-Einstieg (nur ggf. Löschen).
 */
export type EventEditKind = 'single-player' | 'passing' | 'conversion';

export function getEventEditKind(event: GameEvent): EventEditKind | null {
  if (CONTROL_EVENT_TYPES.has(event.type)) {
    return null;
  }
  // Turnover on Downs erfasst nie einen Spieler (für kein Team) – anders als
  // die übrigen "single-player"-Typen gibt es hier kein editierbares Feld.
  if (event.type === EVENT_TYPE.TURNOVER_ON_DOWNS) {
    return null;
  }
  if (event.type === EVENT_TYPE.TOUCHDOWN_PASSING) {
    return 'passing';
  }
  if (event.type === EVENT_TYPE.CONVERSION_1PT || event.type === EVENT_TYPE.CONVERSION_2PT) {
    return 'conversion';
  }
  return event.team === TEAM.PHOENIX ? 'single-player' : null;
}

/**
 * Bearbeiten ist ausschließlich bei abgeschlossenen Spielen möglich – PRD §41
 * wörtlich ("Abgeschlossene Spiele können nachträglich bearbeitet werden"),
 * zusätzlich muss das Event überhaupt ein editierbares Feld besitzen.
 */
export function canEditEvent(game: Game, event: GameEvent): boolean {
  return game.status === GAME_STATUS.FINAL && getEventEditKind(event) !== null;
}

/**
 * Löschen ist ebenfalls nur bei `FINAL` möglich. Die vier Steuerungs-Events
 * (`HALFTIME`/`SECOND_HALF_START`/`TWO_MIN_WARNING`/`GAME_END`) sind
 * schreibgeschützt: `Game.status` wird nicht aus diesen Events abgeleitet,
 * sondern separat gesetzt (siehe `domain/gameFlow.ts`) – ein Löschen würde
 * Status und Event-Historie inkonsistent werden lassen.
 */
export function canDeleteEvent(game: Game, event: GameEvent): boolean {
  return game.status === GAME_STATUS.FINAL && !CONTROL_EVENT_TYPES.has(event.type);
}
