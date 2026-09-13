import { describe, expect, it } from 'vitest';
import { buildInterceptionEvent, formatInterceptionMessage } from './interception';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildInterceptionEvent', () => {
  it('erzeugt eine eigene Interception mit Spieler und 0 Punkten', () => {
    const input = buildInterceptionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.INTERCEPTION,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 0,
      half: HALF.FIRST,
    });
  });

  it('erzeugt eine gegnerische Interception ohne Spieler und 0 Punkten', () => {
    const input = buildInterceptionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.OPPONENT,
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.INTERCEPTION,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 0,
      half: HALF.FIRST,
    });
  });

  it('ignoriert eine übergebene scorerId beim Gegner', () => {
    const input = buildInterceptionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.OPPONENT,
      scorerId: 'sollte-ignoriert-werden',
    });
    expect(input.playerId).toBeNull();
  });
});

describe('formatInterceptionMessage', () => {
  it('formatiert eine eigene Interception ohne Spielstand-Zeile', () => {
    const message = formatInterceptionMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#23 Max Muster',
    });
    expect(message).toBe('Interception Regensburg Phoenix #23 Max Muster');
  });

  it('formatiert eine gegnerische Interception ohne Spielerangabe und ohne Spielstand-Zeile', () => {
    const message = formatInterceptionMessage({
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
    });
    expect(message).toBe('Interception Munich Cowboys');
    expect(message).not.toContain('Spielstand');
  });
});
