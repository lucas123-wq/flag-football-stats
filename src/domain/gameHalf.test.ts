import { describe, expect, it } from 'vitest';
import { resolveCurrentHalf } from './gameHalf';
import { GAME_STATUS, HALF } from './types';

describe('resolveCurrentHalf', () => {
  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, HALF.FIRST],
    [GAME_STATUS.HALFTIME, HALF.FIRST],
    [GAME_STATUS.LIVE_SECOND_HALF, HALF.SECOND],
    [GAME_STATUS.FINAL, HALF.FIRST],
  ])('ordnet %s der Halbzeit %s zu', (status, expected) => {
    expect(resolveCurrentHalf(status)).toBe(expected);
  });
});
