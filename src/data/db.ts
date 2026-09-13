import Dexie, { type EntityTable } from 'dexie';
import type { Game, GameEvent, Player } from '../domain/types';

/**
 * Lokale IndexedDB-Datenbank (Dexie). Enthält Spieler, Spiele und Events als
 * dauerhafte, lokale Datenhaltung (PRD §4) – keine Cloud, kein Server.
 *
 * Index-Entscheidungen:
 * - `players`: kein Index auf `active`, da `boolean` in IndexedDB kein
 *   gültiger Schlüsseltyp ist. Aktive/inaktive Spieler werden stattdessen per
 *   In-Memory-Filter unterschieden (siehe `src/data/players.ts`) – bei einer
 *   Kadergröße von wenigen Dutzend Spielern unproblematisch.
 * - `events`: zusätzlicher Compound-Index `[gameId+sequence]`, um Events
 *   eines Spiels effizient in chronologischer Reihenfolge zu lesen bzw. die
 *   nächste `sequence`-Nummer zu bestimmen.
 */
export class AppDatabase extends Dexie {
  players!: EntityTable<Player, 'id'>;
  games!: EntityTable<Game, 'id'>;
  events!: EntityTable<GameEvent, 'id'>;

  constructor(name = 'regensburg-phoenix-stats') {
    super(name);

    this.version(1).stores({
      players: '&id, jerseyNumber, lastName',
      games: '&id, status, date',
      events: '&id, gameId, [gameId+sequence], type, team, half',
    });
  }
}

/** Einzige Datenbank-Instanz der Anwendung. */
export const db = new AppDatabase();

/**
 * Löscht unwiderruflich ALLE lokalen Daten (Spieler, Spiele, Events) – PRD
 * §45 "Alle Daten löschen". Läuft in einer gemeinsamen Transaktion über alle
 * drei Tabellen, damit niemals nur ein Teil gelöscht wird. Bewusst hier in
 * der DB-Schicht (nicht in einem einzelnen Repository), da die Operation
 * tabellenübergreifend ist – analog zu `deleteGame` in `src/data/games.ts`,
 * das für ein einzelnes Spiel bereits Games+Events gemeinsam löscht.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.players, db.games, db.events, async () => {
    await db.players.clear();
    await db.games.clear();
    await db.events.clear();
  });
}
