import { describe, expect, it } from 'vitest';
import { buildTurnoverOnDownsEvent, formatTurnoverOnDownsMessage } from './turnoverOnDowns';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildTurnoverOnDownsEvent', () => {
  it('erzeugt ein Event mit team=PHOENIX, wenn die EIGENE Offense den Ball bei Downs verliert (NEGATIVE Statistik, keine Interception-Analogie)', () => {
    const input = buildTurnoverOnDownsEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.PHOENIX,
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.PHOENIX,
      points: 0,
      half: HALF.FIRST,
    });
  });

  it('erzeugt ein Event mit team=OPPONENT, wenn der GEGNER den Ball bei Downs verliert', () => {
    const input = buildTurnoverOnDownsEvent({
      gameId: 'game-1',
      half: HALF.SECOND,
      team: TEAM.OPPONENT,
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.SECOND,
    });
  });

  it('kennt kein `scorerId`-Feld – für kein Team wird jemals ein Spieler erfasst', () => {
    const input = buildTurnoverOnDownsEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.PHOENIX,
    });
    expect(input.playerId).toBeUndefined();
  });
});

describe('formatTurnoverOnDownsMessage', () => {
  it('nennt bei team=PHOENIX "Regensburg Phoenix" – das Team, das den Ball verliert, exakt ohne Spielstand-Zeile', () => {
    const message = formatTurnoverOnDownsMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
    });
    expect(message).toBe('Turnover on Downs Regensburg Phoenix');
  });

  it('nennt bei team=OPPONENT den Gegnernamen – das Team, das den Ball verliert, exakt ohne Spielstand-Zeile', () => {
    const message = formatTurnoverOnDownsMessage({
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
    });
    expect(message).toBe('Turnover on Downs Munich Cowboys');
    expect(message).not.toContain('Spielstand');
  });
});
