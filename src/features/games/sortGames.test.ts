import { describe, expect, it } from 'vitest';
import { sortGamesByRecency } from './sortGames';
import { GAME_STATUS } from '../../domain/types';
import type { Game } from '../../domain/types';

function game(overrides: Partial<Game>): Game {
  return {
    id: 'g',
    opponent: 'Gegner',
    date: '2026-01-01',
    status: GAME_STATUS.LIVE_FIRST_HALF,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sortGamesByRecency', () => {
  it('sortiert nach Spieldatum, neuestes zuerst', () => {
    const older = game({ id: 'a', date: '2026-09-01' });
    const newer = game({ id: 'b', date: '2026-09-20' });

    expect(sortGamesByRecency([older, newer]).map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('nutzt createdAt als Tiebreaker bei gleichem Datum', () => {
    const earlierCreated = game({
      id: 'a',
      date: '2026-09-12',
      createdAt: '2026-09-12T08:00:00.000Z',
    });
    const laterCreated = game({
      id: 'b',
      date: '2026-09-12',
      createdAt: '2026-09-12T18:00:00.000Z',
    });

    expect(sortGamesByRecency([earlierCreated, laterCreated]).map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('verändert das Original-Array nicht', () => {
    const games = [game({ id: 'a', date: '2026-01-01' }), game({ id: 'b', date: '2026-09-20' })];
    const original = [...games];

    sortGamesByRecency(games);

    expect(games).toEqual(original);
  });
});
