import { describe, expect, it } from 'vitest';
import { buildSackEvent, formatSackMessage } from './sack';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildSackEvent', () => {
  it('erzeugt einen eigenen Sack mit Spieler und 0 Punkten', () => {
    const input = buildSackEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 0,
      half: HALF.FIRST,
    });
  });

  it('erzeugt einen gegnerischen Sack ohne Spieler und 0 Punkten', () => {
    const input = buildSackEvent({ gameId: 'game-1', half: HALF.FIRST, team: TEAM.OPPONENT });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 0,
      half: HALF.FIRST,
    });
  });
});

describe('formatSackMessage', () => {
  it('formatiert einen eigenen Sack ohne Spielstand-Zeile', () => {
    const message = formatSackMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#44 Max Beispiel',
    });
    expect(message).toBe('Sack Regensburg Phoenix #44 Max Beispiel');
  });

  it('formatiert einen gegnerischen Sack ohne Spielerangabe und ohne Spielstand-Zeile', () => {
    const message = formatSackMessage({ team: TEAM.OPPONENT, opponentName: 'Munich Cowboys' });
    expect(message).toBe('Sack Munich Cowboys');
    expect(message).not.toContain('Spielstand');
  });
});
