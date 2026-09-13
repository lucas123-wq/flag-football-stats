import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllData, db } from './db';
import { createEvent } from './events';
import { createGame } from './games';
import { createPlayer } from './players';
import { EVENT_TYPE, HALF, TEAM } from '../domain/types';

describe('AppDatabase', () => {
  it('öffnet erfolgreich und legt die erwarteten Tabellen an', async () => {
    await db.open();
    const tableNames = db.tables.map((table) => table.name).sort();
    expect(tableNames).toEqual(['events', 'games', 'players']);
  });

  it('erlaubt effiziente Abfrage über den Compound-Index [gameId+sequence]', () => {
    const eventsTable = db.tables.find((table) => table.name === 'events');
    const indexNames = eventsTable?.schema.indexes.map((index) => index.name) ?? [];
    expect(indexNames).toContain('[gameId+sequence]');
  });
});

describe('clearAllData (PRD §45 "Alle Daten löschen")', () => {
  beforeEach(async () => {
    await db.players.clear();
    await db.games.clear();
    await db.events.clear();
  });

  it('löscht Spieler, Spiele und Events vollständig', async () => {
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });

    expect(await db.players.count()).toBe(1);
    expect(await db.games.count()).toBe(1);
    expect(await db.events.count()).toBe(1);

    await clearAllData();

    expect(await db.players.count()).toBe(0);
    expect(await db.games.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });

  it('ist auch bei bereits leeren Tabellen fehlerfrei', async () => {
    await expect(clearAllData()).resolves.toBeUndefined();
    expect(await db.players.count()).toBe(0);
    expect(await db.games.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });

  it('löscht mehrere Spieler/Spiele/Events aller Art vollständig (keine übersehene Tabelle)', async () => {
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    await createPlayer({
      firstName: 'Peter',
      lastName: 'Beispiel',
      jerseyNumber: 7,
      active: false,
    });
    const gameA = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const gameB = await createGame({ opponent: 'Berlin Adler', date: '2026-09-19' });
    await createEvent({
      gameId: gameA.id,
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      points: 6,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: gameB.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });

    await clearAllData();

    expect(await db.players.toArray()).toEqual([]);
    expect(await db.games.toArray()).toEqual([]);
    expect(await db.events.toArray()).toEqual([]);
  });
});
