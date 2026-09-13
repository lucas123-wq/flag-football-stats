import { describe, expect, it } from 'vitest';
import { formatGameDate, getGameStatusLabel, getLiveGameStatusLabel } from './gameFormatting';
import { GAME_STATUS } from '../../domain/types';

describe('getGameStatusLabel', () => {
  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, 'Läuft'],
    [GAME_STATUS.HALFTIME, 'Läuft'],
    [GAME_STATUS.LIVE_SECOND_HALF, 'Läuft'],
    [GAME_STATUS.FINAL, 'Beendet'],
  ])('zeigt für %s "%s" an', (status, expected) => {
    expect(getGameStatusLabel(status)).toBe(expected);
  });
});

describe('getLiveGameStatusLabel', () => {
  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, '1. Halbzeit'],
    [GAME_STATUS.HALFTIME, 'Halbzeit'],
    [GAME_STATUS.LIVE_SECOND_HALF, '2. Halbzeit'],
    [GAME_STATUS.FINAL, 'Beendet'],
  ])('zeigt für %s "%s" an', (status, expected) => {
    expect(getLiveGameStatusLabel(status)).toBe(expected);
  });
});

describe('formatGameDate', () => {
  it('formatiert ein ISO-Datum als deutsches Datum', () => {
    expect(formatGameDate('2026-09-12')).toBe('12.09.2026');
  });
});
