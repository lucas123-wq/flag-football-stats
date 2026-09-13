import { db } from './db';
import { createId } from '../domain/id';
import { assertValidGameInput } from '../domain/gameValidation';
import { GAME_STATUS } from '../domain/types';
import type { Game, GameStatus } from '../domain/types';
import { deleteEventsByGame } from './events';

export interface CreateGameInput {
  opponent: string;
  /** ISO-8601-Datum (yyyy-mm-dd). */
  date: string;
}

export type UpdateGameInput = Partial<Pick<Game, 'opponent' | 'date' | 'status'>>;

/**
 * Legt ein neues Spiel an. Startzustand laut PRD §12: erste Halbzeit,
 * 0:0 (Score wird nicht auf dem Spiel gespeichert, siehe `GameEvent`-Doku –
 * folgt als Ableitung in einem späteren Schritt).
 */
export async function createGame(input: CreateGameInput): Promise<Game> {
  assertValidGameInput({ opponent: input.opponent, date: input.date });

  const now = new Date().toISOString();
  const game: Game = {
    id: createId(),
    opponent: input.opponent.trim(),
    date: input.date,
    status: GAME_STATUS.LIVE_FIRST_HALF,
    createdAt: now,
    updatedAt: now,
  };
  await db.games.add(game);
  return game;
}

export async function getGame(id: string): Promise<Game | undefined> {
  return db.games.get(id);
}

export async function listGames(): Promise<Game[]> {
  return db.games.toArray();
}

export async function updateGame(id: string, changes: UpdateGameInput): Promise<Game> {
  const existing = await db.games.get(id);
  if (!existing) {
    throw new Error(`Spiel ${id} nicht gefunden.`);
  }

  const merged: Game = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  assertValidGameInput({ opponent: merged.opponent, date: merged.date });
  merged.opponent = merged.opponent.trim();

  await db.games.put(merged);
  return merged;
}

export async function setGameStatus(id: string, status: GameStatus): Promise<Game> {
  return updateGame(id, { status });
}

/**
 * Löscht ein Spiel unwiderruflich – inklusive aller zugehörigen Events, damit
 * keine verwaisten Events (mit einer `gameId`, die auf kein Spiel mehr
 * verweist) zurückbleiben. Läuft in einer gemeinsamen Transaktion, damit
 * niemals nur eines von beidem gelöscht wird.
 */
export async function deleteGame(id: string): Promise<void> {
  await db.transaction('rw', db.games, db.events, async () => {
    await deleteEventsByGame(id);
    await db.games.delete(id);
  });
}
