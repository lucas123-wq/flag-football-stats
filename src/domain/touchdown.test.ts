import { describe, expect, it } from 'vitest';
import {
  buildOpponentTouchdownEvent,
  buildPassingTouchdownEvent,
  buildRushingTouchdownEvent,
  formatPlayerLabel,
  formatTouchdownMessage,
} from './touchdown';
import { EVENT_TYPE, HALF, TEAM } from './types';
import type { Player } from './types';

function player(overrides: Partial<Player>): Player {
  return {
    id: 'p1',
    firstName: 'Max',
    lastName: 'Mustermann',
    jerseyNumber: 12,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('formatPlayerLabel', () => {
  it('formatiert Trikotnummer und Name', () => {
    expect(
      formatPlayerLabel(player({ jerseyNumber: 12, firstName: 'Max', lastName: 'Mustermann' })),
    ).toBe('#12 Max Mustermann');
  });
});

describe('buildRushingTouchdownEvent', () => {
  it('erzeugt ein gültiges Event-Input für einen Rushing TD', () => {
    const input = buildRushingTouchdownEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 6,
      half: HALF.FIRST,
    });
  });
});

describe('buildPassingTouchdownEvent', () => {
  it('erzeugt ein gültiges Event-Input für einen Passing TD', () => {
    const input = buildPassingTouchdownEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      qbId: 'qb-1',
      receiverId: 'receiver-1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: 'qb-1',
      receiverId: 'receiver-1',
      points: 6,
      half: HALF.FIRST,
    });
  });
});

describe('buildOpponentTouchdownEvent', () => {
  it('erzeugt ein gültiges Event-Input für einen gegnerischen TD', () => {
    const input = buildOpponentTouchdownEvent({ gameId: 'game-1', half: HALF.FIRST });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      points: 6,
      half: HALF.FIRST,
    });
  });
});

describe('formatTouchdownMessage', () => {
  it('formatiert einen eigenen Rushing-TD wie in der PRD', () => {
    const message = formatTouchdownMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      variant: 'RUSHING',
      scorerLabel: '#12 Max Mustermann',
      scoreAfter: { phoenix: 6, opponent: 0 },
    });
    expect(message).toBe('Touchdown Regensburg Phoenix #12 Max Mustermann\nNeuer Spielstand: 6:0');
  });

  it('formatiert einen eigenen Passing-TD wie in der PRD', () => {
    const message = formatTouchdownMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      variant: 'PASSING',
      qbLabel: '#7 Peter Beispiel',
      receiverLabel: '#12 Max Mustermann',
      scoreAfter: { phoenix: 6, opponent: 0 },
    });
    expect(message).toBe(
      'Touchdown Regensburg Phoenix #7 Peter Beispiel -> #12 Max Mustermann\nNeuer Spielstand: 6:0',
    );
  });

  it('formatiert einen gegnerischen TD wie in der PRD', () => {
    const message = formatTouchdownMessage({
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      scoreAfter: { phoenix: 0, opponent: 6 },
    });
    expect(message).toBe('Touchdown Munich Cowboys\nNeuer Spielstand: 0:6');
  });

  it('zeigt den tatsächlichen (kumulierten) Spielstand nach dem Event', () => {
    const message = formatTouchdownMessage({
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      scoreAfter: { phoenix: 6, opponent: 6 },
    });
    expect(message).toContain('Neuer Spielstand: 6:6');
  });
});
