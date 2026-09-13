import { CONTROL_EVENT_TYPES, CONVERSION_EVENT_TYPES, EVENT_TYPE, TEAM } from './types';
import type { EventType, Half, Team } from './types';

/**
 * Eingabedaten zum Anlegen eines Events (ohne systemseitig vergebene Felder
 * wie `id`, `sequence`, `createdAt`, `updatedAt`).
 *
 * Bewusst NICHT Teil dieses Schritts: Prüfung von `points` gegen die
 * Punkte-Matrix (PRD §33) – das ist Aufgabe der Score-Berechnung in einem
 * späteren Schritt. Diese Validierung stellt ausschließlich sicher, dass
 * Team-/Spieler-Zuordnungen strukturell korrekt sind.
 */
export interface CreateEventInput {
  gameId: string;
  type: EventType;
  team: Team | null;
  playerId?: string | null;
  qbId?: string | null;
  receiverId?: string | null;
  successful?: boolean | null;
  points: number;
  half: Half;
}

/** Eigene Events, bei denen laut PRD ein Spieler ausgewählt werden muss. */
const REQUIRES_OWN_PLAYER: ReadonlySet<EventType> = new Set([
  EVENT_TYPE.TOUCHDOWN_RUSHING,
  EVENT_TYPE.FIRST_DOWN,
  EVENT_TYPE.INTERCEPTION,
  EVENT_TYPE.PICK_6,
  EVENT_TYPE.PICK_2,
  EVENT_TYPE.SACK,
  EVENT_TYPE.SAFETY,
  EVENT_TYPE.SAFETY_1PT,
]);

/**
 * Prüft ein Event auf strukturelle/fachliche Konsistenz (PRD §16–§31) und
 * wirft bei Verstößen einen `Error` mit erklärendem Text. Wird von
 * `createEvent` (siehe `src/data/events.ts`) vor dem Speichern aufgerufen,
 * damit fehlerhafte Daten gar nicht erst persistiert werden.
 */
export function assertValidEventInput(input: CreateEventInput): void {
  const { type, team, playerId = null, qbId = null, receiverId = null, successful = null } = input;

  if (!Number.isFinite(input.points)) {
    throw new Error(`${type}: points muss eine endliche Zahl sein.`);
  }

  if (CONTROL_EVENT_TYPES.has(type)) {
    if (team !== null) {
      throw new Error(`${type}: team muss null sein (Steuerungs-Event, PRD §27/§28/§30/§31).`);
    }
    if (playerId !== null || qbId !== null || receiverId !== null) {
      throw new Error(`${type}: Steuerungs-Events erfassen keinen Spieler.`);
    }
    if (successful !== null) {
      throw new Error(`${type}: successful ist nur bei Conversions zulässig.`);
    }
    return;
  }

  if (team === null) {
    throw new Error(`${type}: team ist erforderlich.`);
  }

  // Eigene Touchdowns unterscheiden Rushing/Passing; der Gegner kennt nur den
  // generischen TOUCHDOWN_OPPONENT (PRD §17.2 vs. §17.3).
  if (
    (type === EVENT_TYPE.TOUCHDOWN_RUSHING || type === EVENT_TYPE.TOUCHDOWN_PASSING) &&
    team !== TEAM.PHOENIX
  ) {
    throw new Error(
      `${type} ist nur für Regensburg Phoenix zulässig (Gegner: TOUCHDOWN_OPPONENT).`,
    );
  }
  if (type === EVENT_TYPE.TOUCHDOWN_OPPONENT && team !== TEAM.OPPONENT) {
    throw new Error(
      'TOUCHDOWN_OPPONENT ist nur für den Gegner zulässig (eigenes Team: TOUCHDOWN_RUSHING/TOUCHDOWN_PASSING).',
    );
  }

  if (type === EVENT_TYPE.TOUCHDOWN_PASSING) {
    if (playerId !== null) {
      throw new Error('TOUCHDOWN_PASSING: playerId wird nicht verwendet (nur qbId/receiverId).');
    }
    if (!qbId || !receiverId) {
      throw new Error('TOUCHDOWN_PASSING: qbId und receiverId sind erforderlich (PRD §17.2).');
    }
    if (qbId === receiverId) {
      throw new Error(
        'TOUCHDOWN_PASSING: qbId und receiverId müssen unterschiedliche Spieler sein.',
      );
    }
    return;
  }

  // Ab hier: alle Typen außer Steuerungs-Events und TOUCHDOWN_PASSING kennen
  // keinen QB/Receiver.
  if (qbId !== null || receiverId !== null) {
    throw new Error(`${type}: qbId/receiverId sind nur bei TOUCHDOWN_PASSING zulässig.`);
  }

  // Gegnerische Events erfassen niemals einen (gegnerischen) Spieler – PRD §8, §34.
  if (team === TEAM.OPPONENT && playerId !== null) {
    throw new Error(`${type}: bei gegnerischen Events darf kein Spieler erfasst werden.`);
  }

  // Turnover on Downs erfasst NIE einen Spieler – für keins der beiden Teams
  // (im Unterschied zu First Down/Interception/Sack, die beim eigenen Team
  // einen Spieler verlangen).
  if (type === EVENT_TYPE.TURNOVER_ON_DOWNS && playerId !== null) {
    throw new Error(`${type}: es wird nie ein Spieler erfasst (für kein Team).`);
  }

  if (CONVERSION_EVENT_TYPES.has(type)) {
    if (successful === null) {
      throw new Error(`${type}: successful (Conversion erfolgreich?) ist erforderlich.`);
    }
    if (team === TEAM.PHOENIX) {
      if (successful && !playerId) {
        throw new Error(
          `${type}: bei erfolgreicher Conversion ist playerId erforderlich (PRD §18/§19).`,
        );
      }
      if (!successful && playerId !== null) {
        throw new Error(
          `${type}: bei nicht erfolgreicher Conversion darf kein Spieler erfasst werden (PRD §18/§19).`,
        );
      }
    }
    return;
  }

  if (successful !== null) {
    throw new Error(`${type}: successful ist nur bei Conversions zulässig.`);
  }

  if (REQUIRES_OWN_PLAYER.has(type) && team === TEAM.PHOENIX && !playerId) {
    throw new Error(`${type} (Regensburg Phoenix): playerId ist erforderlich.`);
  }
}
