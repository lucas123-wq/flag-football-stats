import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup } from './backup';
import { db } from './db';
import { createEvent } from './events';
import { createGame } from './games';
import { createPlayer } from './players';
import { BACKUP_SCHEMA_VERSION, parseBackupJson } from '../domain/backup';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from '../domain/types';
import type { BackupFile } from '../domain/backup';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

describe('exportBackup', () => {
  it('enthält alle Spieler, Spiele und Events aus der Datenbank', async () => {
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });

    const json = await exportBackup();
    const backup = parseBackupJson(json);

    expect(backup.players).toEqual([player]);
    expect(backup.games).toEqual([game]);
    expect(backup.events).toEqual([event]);
  });

  it('behält IDs und Beziehungen bei mehreren Spielern/Spielen/Events unverändert bei', async () => {
    const qb = await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    const receiver = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const gameA = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const gameB = await createGame({ opponent: 'Berlin Adler', date: '2026-09-19' });
    const passingTd = await createEvent({
      gameId: gameA.id,
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: qb.id,
      receiverId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });
    const sack = await createEvent({
      gameId: gameB.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });

    const backup = parseBackupJson(await exportBackup());

    expect(backup.players.map((p) => p.id).sort()).toEqual([qb.id, receiver.id].sort());
    expect(backup.games.map((g) => g.id).sort()).toEqual([gameA.id, gameB.id].sort());
    const exportedPassingTd = backup.events.find((e) => e.id === passingTd.id);
    expect(exportedPassingTd?.qbId).toBe(qb.id);
    expect(exportedPassingTd?.receiverId).toBe(receiver.id);
    expect(backup.events.find((e) => e.id === sack.id)?.gameId).toBe(gameB.id);
  });

  it('enthält eine gültige Backup-Version', async () => {
    const backup = parseBackupJson(await exportBackup());
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it('funktioniert mit vollständig leerer Datenbank', async () => {
    const backup = parseBackupJson(await exportBackup());
    expect(backup.players).toEqual([]);
    expect(backup.games).toEqual([]);
    expect(backup.events).toEqual([]);
  });

  it('enthält ausschließlich die drei Datenbank-Felder (keine unnötigen UI-Daten)', async () => {
    const json = await exportBackup();
    const raw = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual([
      'events',
      'exportedAt',
      'games',
      'players',
      'schemaVersion',
    ]);
  });
});

describe('restoreBackup', () => {
  it('stellt Spieler, Spiele und Events aus einem Backup wieder her und ersetzt den bestehenden Datenbestand vollständig (PRD §5: Wiederherstellung, kein Merge)', async () => {
    // Bestehende (alte) Daten, die durch den Import ersetzt werden sollen.
    await createPlayer({ firstName: 'Alter', lastName: 'Spieler', jerseyNumber: 99 });
    const oldGame = await createGame({ opponent: 'Alter Gegner', date: '2020-01-01' });
    await createEvent({
      gameId: oldGame.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });

    const backup: BackupFile = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-09-12T12:00:00.000Z',
      players: [
        {
          id: 'p1',
          firstName: 'Max',
          lastName: 'Mustermann',
          jerseyNumber: 12,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      games: [
        {
          id: 'g1',
          opponent: 'Munich Cowboys',
          date: '2026-09-12',
          status: GAME_STATUS.FINAL,
          createdAt: '2026-09-12T09:00:00.000Z',
          updatedAt: '2026-09-12T11:00:00.000Z',
        },
      ],
      events: [
        {
          id: 'e1',
          gameId: 'g1',
          sequence: 1,
          type: EVENT_TYPE.TOUCHDOWN_RUSHING,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          qbId: null,
          receiverId: null,
          successful: null,
          points: 6,
          half: HALF.FIRST,
          createdAt: '2026-09-12T09:05:00.000Z',
          updatedAt: '2026-09-12T09:05:00.000Z',
        },
      ],
    };

    await restoreBackup(backup);

    const players = await db.players.toArray();
    const games = await db.games.toArray();
    const events = await db.events.toArray();
    expect(players).toEqual(backup.players);
    expect(games).toEqual(backup.games);
    expect(events).toEqual(backup.events);
    // Die alten Daten sind vollständig weg, nicht nur ergänzt.
    expect(players.find((p) => p.jerseyNumber === 99)).toBeUndefined();
    expect(games.find((g) => g.opponent === 'Alter Gegner')).toBeUndefined();
  });

  it('funktioniert mit einem leeren Backup (löscht bestehende Daten vollständig, fügt nichts hinzu)', async () => {
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const emptyBackup: BackupFile = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      players: [],
      games: [],
      events: [],
    };

    await restoreBackup(emptyBackup);

    expect(await db.players.count()).toBe(0);
  });

  it('ist atomar: schlägt der Import fehl, bleibt der bestehende Datenbestand vollständig unverändert', async () => {
    const existingPlayer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    // Absichtlich inkonsistentes "Backup" (doppelte ID), das erst beim
    // `bulkAdd` in der Transaktion fehlschlägt – simuliert einen Fehler
    // NACH dem `clearAllData()`-Schritt, um die Rollback-Garantie der
    // Dexie-Transaktion zu prüfen.
    const brokenBackup: BackupFile = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      players: [
        {
          id: 'dup',
          firstName: 'Eins',
          lastName: 'Eins',
          jerseyNumber: 1,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'dup',
          firstName: 'Zwei',
          lastName: 'Zwei',
          jerseyNumber: 2,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      games: [],
      events: [],
    };

    await expect(restoreBackup(brokenBackup)).rejects.toThrow();

    // Trotz Fehler mitten in der Transaktion (nach dem Löschen) ist der
    // ursprüngliche Datenbestand vollständig erhalten geblieben.
    const players = await db.players.toArray();
    expect(players).toEqual([existingPlayer]);
  });
});
