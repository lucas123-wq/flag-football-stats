import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createEvent, listEventsByGame } from './events';
import { createGame, deleteGame, getGame, listGames, setGameStatus } from './games';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from '../domain/types';

beforeEach(async () => {
  await db.games.clear();
  await db.events.clear();
});

describe('games repository', () => {
  it('erstellt ein Spiel im Startzustand (PRD §12)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    expect(game.id).toBeTruthy();
    expect(game.opponent).toBe('Munich Cowboys');
    expect(game.date).toBe('2026-09-12');
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);

    const loaded = await getGame(game.id);
    expect(loaded).toEqual(game);
  });

  it('gehört immer zu genau einem Gegner', async () => {
    const game = await createGame({ opponent: 'Stuttgart Scorpions', date: '2026-09-20' });
    expect(typeof game.opponent).toBe('string');
    expect(game.opponent).toBe('Stuttgart Scorpions');
  });

  it('listet mehrere Spiele', async () => {
    await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createGame({ opponent: 'Stuttgart Scorpions', date: '2026-09-20' });

    const all = await listGames();
    expect(all).toHaveLength(2);
  });

  it('ändert den Spielstatus (z. B. Richtung Halbzeit)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    const updated = await setGameStatus(game.id, GAME_STATUS.HALFTIME);
    expect(updated.status).toBe(GAME_STATUS.HALFTIME);

    const reloaded = await getGame(game.id);
    expect(reloaded?.status).toBe(GAME_STATUS.HALFTIME);
  });

  it('lehnt einen fehlenden Gegnernamen beim Anlegen ab', async () => {
    await expect(createGame({ opponent: '  ', date: '2026-09-12' })).rejects.toThrow(/Gegnername/);
    expect(await listGames()).toHaveLength(0);
  });

  it('löscht ein Spiel unwiderruflich', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    await deleteGame(game.id);

    expect(await getGame(game.id)).toBeUndefined();
    expect(await listGames()).toHaveLength(0);
  });

  it('löscht beim Löschen eines Spiels auch dessen Events (keine Waisen)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const otherGame = await createGame({ opponent: 'Stuttgart Scorpions', date: '2026-09-20' });

    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: 'player-1',
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: otherGame.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: 'player-1',
      points: 0,
      half: HALF.FIRST,
    });

    await deleteGame(game.id);

    expect(await listEventsByGame(game.id)).toHaveLength(0);
    // Events des anderen Spiels bleiben unberührt.
    expect(await listEventsByGame(otherGame.id)).toHaveLength(1);
    expect(await db.events.count()).toBe(1);
  });
});
