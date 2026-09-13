import { describe, expect, it } from 'vitest';
import { buildConversionEvent, formatConversionMessage } from './conversion';
import { EVENT_TYPE, HALF, TEAM } from './types';

describe('buildConversionEvent', () => {
  it('erzeugt eine erfolgreiche eigene 1-Punkt-Conversion mit Spieler und +1 Punkt', () => {
    const input = buildConversionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      conversionType: '1PT',
      team: TEAM.PHOENIX,
      successful: true,
      scorerId: 'p1',
    });
    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.PHOENIX,
      playerId: 'p1',
      successful: true,
      points: 1,
      half: HALF.FIRST,
    });
  });

  it('erzeugt eine erfolgreiche eigene 2-Punkt-Conversion mit Spieler und +2 Punkten', () => {
    const input = buildConversionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      conversionType: '2PT',
      team: TEAM.PHOENIX,
      successful: true,
      scorerId: 'p1',
    });
    expect(input).toMatchObject({ type: EVENT_TYPE.CONVERSION_2PT, playerId: 'p1', points: 2 });
  });

  it('erzeugt eine fehlgeschlagene eigene Conversion ohne Spieler und 0 Punkten', () => {
    const input = buildConversionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      conversionType: '1PT',
      team: TEAM.PHOENIX,
      successful: false,
      scorerId: 'p1', // wird ignoriert, da nicht erfolgreich
    });
    expect(input).toMatchObject({ playerId: null, successful: false, points: 0 });
  });

  it('erzeugt eine erfolgreiche gegnerische Conversion ohne Spieler', () => {
    const input = buildConversionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      conversionType: '2PT',
      team: TEAM.OPPONENT,
      successful: true,
    });
    expect(input).toMatchObject({ team: TEAM.OPPONENT, playerId: null, points: 2 });
  });

  it('erzeugt eine fehlgeschlagene gegnerische Conversion ohne Spieler und 0 Punkten', () => {
    const input = buildConversionEvent({
      gameId: 'game-1',
      half: HALF.FIRST,
      conversionType: '1PT',
      team: TEAM.OPPONENT,
      successful: false,
    });
    expect(input).toMatchObject({ team: TEAM.OPPONENT, playerId: null, points: 0 });
  });
});

describe('formatConversionMessage', () => {
  it('formatiert eine erfolgreiche eigene 1 Pt Conversion (PRD §18)', () => {
    const message = formatConversionMessage({
      conversionType: '1PT',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      successful: true,
      scorerLabel: '#12 Max Mustermann',
      scoreAfter: { phoenix: 7, opponent: 0 },
    });
    expect(message).toBe(
      '1 Pt Conversion Regensburg Phoenix #12 Max Mustermann\nNeuer Spielstand: 7:0',
    );
  });

  it('formatiert eine fehlgeschlagene eigene 1 Pt Conversion exakt nach PRD §18 (einzeilig, ohne Spielstand)', () => {
    const message = formatConversionMessage({
      conversionType: '1PT',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      successful: false,
      scoreAfter: { phoenix: 6, opponent: 0 },
    });
    expect(message).toBe('1 Pt Conversion Regensburg Phoenix – nicht gut');
  });

  it('formatiert eine erfolgreiche eigene 2 Pt Conversion (PRD §19)', () => {
    const message = formatConversionMessage({
      conversionType: '2PT',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      successful: true,
      scorerLabel: '#12 Max Mustermann',
      scoreAfter: { phoenix: 8, opponent: 0 },
    });
    expect(message).toBe(
      '2 Pt Conversion Regensburg Phoenix #12 Max Mustermann\nNeuer Spielstand: 8:0',
    );
  });

  it('formatiert eine fehlgeschlagene eigene 2 Pt Conversion exakt nach PRD §19 (einzeilig, ohne Spielstand)', () => {
    const message = formatConversionMessage({
      conversionType: '2PT',
      team: TEAM.PHOENIX,
      opponentName: 'Munich Cowboys',
      successful: false,
      scoreAfter: { phoenix: 6, opponent: 0 },
    });
    expect(message).toBe('2 Pt Conversion Regensburg Phoenix – nicht gut');
  });

  it('formatiert eine erfolgreiche gegnerische 1 Pt Conversion ohne Spielerangabe', () => {
    const message = formatConversionMessage({
      conversionType: '1PT',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      successful: true,
      scoreAfter: { phoenix: 7, opponent: 7 },
    });
    expect(message).toBe('1 Pt Conversion Munich Cowboys\nNeuer Spielstand: 7:7');
  });

  it('formatiert eine erfolgreiche gegnerische 2 Pt Conversion ohne Spielerangabe', () => {
    const message = formatConversionMessage({
      conversionType: '2PT',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      successful: true,
      scoreAfter: { phoenix: 6, opponent: 8 },
    });
    expect(message).toBe('2 Pt Conversion Munich Cowboys\nNeuer Spielstand: 6:8');
  });

  it('formatiert eine fehlgeschlagene gegnerische Conversion exakt nach PRD (einzeilig, ohne Spielstand)', () => {
    const message = formatConversionMessage({
      conversionType: '1PT',
      team: TEAM.OPPONENT,
      opponentName: 'Munich Cowboys',
      successful: false,
      scoreAfter: { phoenix: 6, opponent: 6 },
    });
    expect(message).toBe('1 Pt Conversion Munich Cowboys – nicht gut');
  });
});
