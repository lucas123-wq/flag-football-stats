import { describe, expect, it } from 'vitest';
import { buildPickEvent, formatPickMessage } from './pick';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildPickEvent', () => {
  it('erzeugt ein eigenes Pick-6-Event mit Spieler und +6 Punkten', () => {
    const input = buildPickEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'SIX',
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.PICK_6,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 6,
      half: HALF.FIRST,
    });
  });

  it('erzeugt ein eigenes Pick-2-Event mit Spieler und +2 Punkten', () => {
    const input = buildPickEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'TWO',
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.PICK_2,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 2,
      half: HALF.FIRST,
    });
  });

  it('erzeugt ein gegnerisches Pick-6-Event ohne Spieler', () => {
    const input = buildPickEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'SIX',
      team: TEAM.OPPONENT,
    });
    expect(input).toMatchObject({
      type: EVENT_TYPE.PICK_6,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 6,
    });
  });

  it('erzeugt ein gegnerisches Pick-2-Event ohne Spieler', () => {
    const input = buildPickEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'TWO',
      team: TEAM.OPPONENT,
    });
    expect(input).toMatchObject({
      type: EVENT_TYPE.PICK_2,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 2,
    });
  });
});

describe('formatPickMessage', () => {
  it('formatiert einen eigenen Pick 6 mit Spielstand', () => {
    const message = formatPickMessage({
      variant: 'SIX',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#23 Max Muster',
      scoreAfter: { phoenix: 12, opponent: 0 },
    });
    expect(message).toBe('Pick 6 Regensburg Phoenix #23 Max Muster\nNeuer Spielstand: 12:0');
  });

  it('formatiert einen eigenen Pick 2 mit Spielstand', () => {
    const message = formatPickMessage({
      variant: 'TWO',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#23 Max Muster',
      scoreAfter: { phoenix: 8, opponent: 0 },
    });
    expect(message).toBe('Pick 2 Regensburg Phoenix #23 Max Muster\nNeuer Spielstand: 8:0');
  });

  it('formatiert einen gegnerischen Pick 6 ohne Spielerangabe mit Spielstand', () => {
    const message = formatPickMessage({
      variant: 'SIX',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      scoreAfter: { phoenix: 6, opponent: 6 },
    });
    expect(message).toBe('Pick 6 Munich Cowboys\nNeuer Spielstand: 6:6');
  });

  it('formatiert einen gegnerischen Pick 2 ohne Spielerangabe mit Spielstand', () => {
    const message = formatPickMessage({
      variant: 'TWO',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      scoreAfter: { phoenix: 6, opponent: 2 },
    });
    expect(message).toBe('Pick 2 Munich Cowboys\nNeuer Spielstand: 6:2');
  });
});
