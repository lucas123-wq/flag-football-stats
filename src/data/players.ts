import { db } from './db';
import { createId } from '../domain/id';
import { assertValidPlayerInput } from '../domain/playerValidation';
import type { Player } from '../domain/types';

export interface CreatePlayerInput {
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  /** Default: `true` (neue Spieler sind zunächst aktiv). */
  active?: boolean;
}

export type UpdatePlayerInput = Partial<
  Pick<Player, 'firstName' | 'lastName' | 'jerseyNumber' | 'active'>
>;

/**
 * Legt einen neuen Spieler an. Validiert vorher (Pflichtfelder, gültige
 * Trikotnummer, keine doppelte Trikotnummer unter aktiven Spielern) – siehe
 * `domain/playerValidation.ts`. Die UI führt dieselbe Prüfung zusätzlich
 * selbst aus, um Fehler sofort feldbezogen anzuzeigen; hier dient sie als
 * Sicherheitsnetz auf Datenebene (analog zu `createEvent`).
 */
export async function createPlayer(input: CreatePlayerInput): Promise<Player> {
  const active = input.active ?? true;
  const existingPlayers = await db.players.toArray();
  assertValidPlayerInput(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      jerseyNumber: input.jerseyNumber,
      active,
    },
    { existingPlayers },
  );

  const now = new Date().toISOString();
  const player: Player = {
    id: createId(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    jerseyNumber: input.jerseyNumber,
    active,
    createdAt: now,
    updatedAt: now,
  };
  await db.players.add(player);
  return player;
}

export async function getPlayer(id: string): Promise<Player | undefined> {
  return db.players.get(id);
}

export async function listPlayers(): Promise<Player[]> {
  return db.players.toArray();
}

/** Nur aktive Spieler (Standardauswahl bei der Eventerfassung, PRD §9.1). */
export async function listActivePlayers(): Promise<Player[]> {
  return db.players.filter((player) => player.active).toArray();
}

export async function updatePlayer(id: string, changes: UpdatePlayerInput): Promise<Player> {
  const existing = await db.players.get(id);
  if (!existing) {
    throw new Error(`Spieler ${id} nicht gefunden.`);
  }

  const merged: Player = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  const existingPlayers = await db.players.toArray();
  assertValidPlayerInput(
    {
      firstName: merged.firstName,
      lastName: merged.lastName,
      jerseyNumber: merged.jerseyNumber,
      active: merged.active,
    },
    { existingPlayers, excludePlayerId: id },
  );

  merged.firstName = merged.firstName.trim();
  merged.lastName = merged.lastName.trim();

  await db.players.put(merged);
  return merged;
}

// Bewusst KEIN `deletePlayer`: Laut PRD §9.2 dürfen Spieler, die bereits in
// einem Event verwendet wurden, nicht physisch gelöscht werden – historische
// Events müssen weiterhin auf sie verweisen können. Das "Entfernen" eines
// Spielers aus der Auswahl erfolgt ausschließlich über `active: false`
// (Deaktivierung), nicht über Löschen.
