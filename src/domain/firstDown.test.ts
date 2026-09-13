import { describe, expect, it } from 'vitest';
import { buildFirstDownEvent, formatFirstDownMessage } from './firstDown';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildFirstDownEvent', () => {
  it('erzeugt ein eigenes First-Down-Event mit Spieler und 0 Punkten', () => {
    const input = buildFirstDownEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 0,
      half: HALF.FIRST,
    });
  });

  it('erzeugt ein gegnerisches First-Down-Event ohne Spieler und 0 Punkten', () => {
    const input = buildFirstDownEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.OPPONENT,
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 0,
      half: HALF.FIRST,
    });
  });

  it('ignoriert eine übergebene scorerId beim Gegner (kein gegnerischer Spieler)', () => {
    const input = buildFirstDownEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      team: TEAM.OPPONENT,
      scorerId: 'sollte-ignoriert-werden',
    });
    expect(input.playerId).toBeNull();
  });
});

describe('formatFirstDownMessage', () => {
  it('formatiert einen eigenen First Down ohne Spielstand-Zeile (Score ändert sich nicht)', () => {
    const message = formatFirstDownMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#12 Max Mustermann',
    });
    expect(message).toBe('First Down Regensburg Phoenix #12 Max Mustermann');
  });

  it('formatiert einen gegnerischen First Down ohne Spielerangabe und ohne Spielstand-Zeile', () => {
    const message = formatFirstDownMessage({
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
    });
    expect(message).toBe('First Down Munich Cowboys');
  });

  it('enthält weder "Spielstand:" noch "Neuer Spielstand:"', () => {
    const message = formatFirstDownMessage({
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#12 Max Mustermann',
    });
    expect(message).not.toContain('Spielstand');
  });
});
