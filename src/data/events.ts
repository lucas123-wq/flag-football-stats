import Dexie from 'dexie';
import { db } from './db';
import { createId } from '../domain/id';
import { assertValidEventInput, type CreateEventInput } from '../domain/eventValidation';
import type { GameEvent } from '../domain/types';

export type { CreateEventInput } from '../domain/eventValidation';

export type UpdateEventInput = Partial<
  Pick<
    GameEvent,
    'type' | 'team' | 'playerId' | 'qbId' | 'receiverId' | 'successful' | 'points' | 'half'
  >
>;

/**
 * Ermittelt die nächste `sequence`-Nummer für ein Spiel über den Compound-
 * Index `[gameId+sequence]`. Läuft innerhalb der aufrufenden Transaktion
 * (siehe `createEvent`), damit bei schneller Bedienung keine doppelten
 * Sequenznummern entstehen.
 */
async function getNextSequence(gameId: string): Promise<number> {
  const lastEvent = await db.events
    .where('[gameId+sequence]')
    .between([gameId, Dexie.minKey], [gameId, Dexie.maxKey])
    .last();
  return (lastEvent?.sequence ?? 0) + 1;
}

/**
 * Legt ein neues Event an. Validiert vorher die fachliche Konsistenz
 * (`assertValidEventInput`) und vergibt eine fortlaufende `sequence` je Spiel
 * innerhalb einer Schreibtransaktion.
 *
 * Enthält bewusst KEINE Score-/Statistikberechnung – Events sind laut PRD §35
 * die alleinige Quelle dafür, die Ableitung erfolgt in einem späteren Schritt.
 */
export async function createEvent(input: CreateEventInput): Promise<GameEvent> {
  assertValidEventInput(input);

  return db.transaction('rw', db.events, async () => {
    const sequence = await getNextSequence(input.gameId);
    const now = new Date().toISOString();
    const event: GameEvent = {
      id: createId(),
      gameId: input.gameId,
      sequence,
      type: input.type,
      team: input.team,
      playerId: input.playerId ?? null,
      qbId: input.qbId ?? null,
      receiverId: input.receiverId ?? null,
      successful: input.successful ?? null,
      points: input.points,
      half: input.half,
      createdAt: now,
      updatedAt: now,
    };
    await db.events.add(event);
    return event;
  });
}

export async function getEvent(id: string): Promise<GameEvent | undefined> {
  return db.events.get(id);
}

/** Alle Events eines Spiels in chronologischer Reihenfolge (PRD §39 Liveticker). */
export async function listEventsByGame(gameId: string): Promise<GameEvent[]> {
  return db.events.where('gameId').equals(gameId).sortBy('sequence');
}

export async function updateEvent(id: string, changes: UpdateEventInput): Promise<GameEvent> {
  const existing = await db.events.get(id);
  if (!existing) {
    throw new Error(`Event ${id} nicht gefunden.`);
  }
  const merged: GameEvent = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  assertValidEventInput(merged);
  await db.events.put(merged);
  return merged;
}

export async function deleteEvent(id: string): Promise<void> {
  await db.events.delete(id);
}

/**
 * Löscht alle Events eines Spiels. Wird von `deleteGame` (siehe
 * `src/data/games.ts`) verwendet, damit beim Löschen eines Spiels keine
 * verwaisten Events zurückbleiben.
 */
export async function deleteEventsByGame(gameId: string): Promise<void> {
  await db.events.where('gameId').equals(gameId).delete();
}
