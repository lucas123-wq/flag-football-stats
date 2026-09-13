import { describe, expect, it } from 'vitest';
import { calculateScore } from './scoring';
import { EVENT_TYPE, HALF, TEAM } from './types';
import type { GameEvent } from './types';

let sequence = 0;

function event(overrides: Partial<GameEvent>): GameEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    gameId: 'game-1',
    sequence,
    type: EVENT_TYPE.TOUCHDOWN_RUSHING,
    team: TEAM.PHOENIX,
    playerId: 'player-1',
    qbId: null,
    receiverId: null,
    successful: null,
    points: 6,
    half: HALF.FIRST,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateScore', () => {
  it('ergibt 0:0 ohne Events', () => {
    expect(calculateScore([])).toEqual({ phoenix: 0, opponent: 0 });
  });

  it('eigener Touchdown ergibt 6:0', () => {
    const events = [event({ team: TEAM.PHOENIX, points: 6 })];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('gegnerischer Touchdown ergibt 0:6', () => {
    const events = [
      event({
        type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
        team: TEAM.OPPONENT,
        playerId: null,
        points: 6,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 6 });
  });

  it('eigener TD + gegnerischer TD ergibt 6:6', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
        team: TEAM.OPPONENT,
        playerId: null,
        points: 6,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 6 });
  });

  it('zwei eigene TDs ergeben 12:0', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({ team: TEAM.PHOENIX, points: 6 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 12, opponent: 0 });
  });

  it('addiert mehrere unterschiedliche Events korrekt', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
        team: TEAM.OPPONENT,
        playerId: null,
        points: 6,
      }),
      // Steuerungs-Event ohne Team/Punkte-Relevanz.
      event({
        type: EVENT_TYPE.TWO_MIN_WARNING,
        team: null,
        playerId: null,
        points: 0,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 12, opponent: 6 });
  });

  it('TD → 6:0', () => {
    const events = [event({ team: TEAM.PHOENIX, points: 6 })];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('TD + erfolgreiche 1-Punkt-Conversion → 7:0', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 1,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 7, opponent: 0 });
  });

  it('TD + erfolgreiche 2-Punkt-Conversion → 8:0', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 2,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 8, opponent: 0 });
  });

  it('TD + fehlgeschlagene 1-Punkt-Conversion → 6:0', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: null,
        successful: false,
        points: 0,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('TD + fehlgeschlagene 2-Punkt-Conversion → 6:0', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        team: TEAM.PHOENIX,
        playerId: null,
        successful: false,
        points: 0,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('eigener TD + gegnerischer TD + beidseitige Conversions', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 1,
      }),
      event({
        type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
        team: TEAM.OPPONENT,
        playerId: null,
        points: 6,
      }),
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        team: TEAM.OPPONENT,
        playerId: null,
        successful: true,
        points: 2,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 7, opponent: 8 });
  });

  it('mehrere Conversions verschiedener Erfolge werden korrekt addiert', () => {
    const events = [
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 1,
      }),
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 2,
      }),
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: null,
        successful: false,
        points: 0,
      }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 3, opponent: 0 });
  });

  it('0:0 + First Down = 0:0', () => {
    const events = [
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 0 });
  });

  it('6:0 + First Down = 6:0', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('7:6 + First Down = 7:6', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 1,
      }),
      event({
        type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
        team: TEAM.OPPONENT,
        playerId: null,
        points: 6,
      }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.OPPONENT, playerId: null, points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 7, opponent: 6 });
  });

  it('mehrere First Downs verändern den Score nicht', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-2', points: 0 }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.OPPONENT, playerId: null, points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('TD + Conversion + First Down ergibt weiterhin den korrekten Score', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }),
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 2,
      }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 8, opponent: 0 });
  });

  it('Interception verändert den Score nicht', () => {
    const events = [
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 0 });
  });

  it('Pick 6 ergibt +6', () => {
    const events = [
      event({ type: EVENT_TYPE.PICK_6, team: TEAM.PHOENIX, playerId: 'player-1', points: 6 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('Pick 2 ergibt +2', () => {
    const events = [
      event({ type: EVENT_TYPE.PICK_2, team: TEAM.PHOENIX, playerId: 'player-1', points: 2 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 2, opponent: 0 });
  });

  it('Sack verändert den Score nicht', () => {
    const events = [
      event({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 0 });
  });

  it('Safety ergibt +2 für das erzielende Team', () => {
    const own = [
      event({ type: EVENT_TYPE.SAFETY, team: TEAM.PHOENIX, playerId: 'player-1', points: 2 }),
    ];
    expect(calculateScore(own)).toEqual({ phoenix: 2, opponent: 0 });

    const opponent = [
      event({ type: EVENT_TYPE.SAFETY, team: TEAM.OPPONENT, playerId: null, points: 2 }),
    ];
    expect(calculateScore(opponent)).toEqual({ phoenix: 0, opponent: 2 });
  });

  it('1-Punkt-Safety ergibt +1 für das erzielende Team', () => {
    const own = [
      event({ type: EVENT_TYPE.SAFETY_1PT, team: TEAM.PHOENIX, playerId: 'player-1', points: 1 }),
    ];
    expect(calculateScore(own)).toEqual({ phoenix: 1, opponent: 0 });

    const opponent = [
      event({ type: EVENT_TYPE.SAFETY_1PT, team: TEAM.OPPONENT, playerId: null, points: 1 }),
    ];
    expect(calculateScore(opponent)).toEqual({ phoenix: 0, opponent: 1 });
  });

  it('TD + Conversion + First Down + Interception + Pick 6 + Pick 2 + Sack + Safety ergibt den korrekten Gesamtscore', () => {
    const events = [
      event({ team: TEAM.PHOENIX, points: 6 }), // TD +6
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'player-1',
        successful: true,
        points: 1,
      }), // +1
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }), // +0
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'player-2', points: 0 }), // +0
      event({ type: EVENT_TYPE.PICK_6, team: TEAM.PHOENIX, playerId: 'player-2', points: 6 }), // +6
      event({ type: EVENT_TYPE.PICK_2, team: TEAM.OPPONENT, playerId: null, points: 2 }), // Gegner +2
      event({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }), // +0
      event({ type: EVENT_TYPE.SAFETY, team: TEAM.OPPONENT, playerId: null, points: 2 }), // Gegner +2
    ];
    // Phoenix: 6 + 1 + 6 = 13, Opponent: 2 + 2 = 4
    expect(calculateScore(events)).toEqual({ phoenix: 13, opponent: 4 });
  });
});
