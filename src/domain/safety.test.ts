import { describe, expect, it } from 'vitest';
import { buildSafetyEvent, formatSafetyMessage } from './safety';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildSafetyEvent', () => {
  it('erzeugt eine eigene Safety mit Spieler und +2 Punkten', () => {
    const input = buildSafetyEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'SAFETY',
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.SAFETY,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 2,
      half: HALF.FIRST,
    });
  });

  it('erzeugt eine eigene 1-Punkt-Safety mit Spieler und +1 Punkt', () => {
    const input = buildSafetyEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'SAFETY_1PT',
      team: TEAM.PHOENIX,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.SAFETY_1PT,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      points: 1,
      half: HALF.FIRST,
    });
  });

  it('erzeugt eine gegnerische Safety ohne Spieler und +2 Punkten für den Gegner', () => {
    const input = buildSafetyEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'SAFETY',
      team: TEAM.OPPONENT,
    });
    expect(input).toMatchObject({ team: TEAM.OPPONENT, playerId: null, points: 2 });
  });

  it('erzeugt eine gegnerische 1-Punkt-Safety ohne Spieler und +1 Punkt für den Gegner', () => {
    const input = buildSafetyEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      variant: 'SAFETY_1PT',
      team: TEAM.OPPONENT,
    });
    expect(input).toMatchObject({ team: TEAM.OPPONENT, playerId: null, points: 1 });
  });
});

describe('formatSafetyMessage', () => {
  it('formatiert eine eigene Safety mit Spielstand', () => {
    const message = formatSafetyMessage({
      variant: 'SAFETY',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#44 Max Beispiel',
      scoreAfter: { phoenix: 16, opponent: 8 },
    });
    expect(message).toBe('Safety Regensburg Phoenix #44 Max Beispiel\nNeuer Spielstand: 16:8');
  });

  it('formatiert eine eigene 1-Punkt-Safety mit Spielstand', () => {
    const message = formatSafetyMessage({
      variant: 'SAFETY_1PT',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      scorerLabel: '#44 Max Beispiel',
      scoreAfter: { phoenix: 17, opponent: 10 },
    });
    expect(message).toBe(
      '1 Pt Safety Regensburg Phoenix #44 Max Beispiel\nNeuer Spielstand: 17:10',
    );
  });

  it('formatiert eine gegnerische Safety ohne Spielerangabe mit Spielstand', () => {
    const message = formatSafetyMessage({
      variant: 'SAFETY',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      scoreAfter: { phoenix: 16, opponent: 10 },
    });
    expect(message).toBe('Safety Munich Cowboys\nNeuer Spielstand: 16:10');
  });

  it('formatiert eine gegnerische 1-Punkt-Safety ohne Spielerangabe mit Spielstand', () => {
    const message = formatSafetyMessage({
      variant: 'SAFETY_1PT',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      scoreAfter: { phoenix: 17, opponent: 11 },
    });
    expect(message).toBe('1 Pt Safety Munich Cowboys\nNeuer Spielstand: 17:11');
  });
});
