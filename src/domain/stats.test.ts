import { describe, expect, it } from 'vitest';
import { calculatePlayerStats, getParticipantPlayerIds } from './stats';
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
    playerId: null,
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

describe('calculatePlayerStats', () => {
  const ZERO_STATS = {
    rushingTouchdowns: 0,
    passingTouchdowns: 0,
    receivingTouchdowns: 0,
    onePointConversions: 0,
    twoPointConversions: 0,
    firstDowns: 0,
    interceptions: 0,
    pickSixes: 0,
    pickTwos: 0,
    sacks: 0,
    safeties: 0,
    onePointSafeties: 0,
  };

  it('ergibt lauter Nullen ohne passende Events', () => {
    expect(calculatePlayerStats([], 'player-1')).toEqual(ZERO_STATS);
  });

  it('zählt Rushing TD +1 für den Scorer', () => {
    const events = [event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, playerId: 'player-1' })];
    expect(calculatePlayerStats(events, 'player-1').rushingTouchdowns).toBe(1);
  });

  it('zählt Passing TD +1 für den QB und Receiving TD +1 für den Receiver', () => {
    const events = [
      event({
        type: EVENT_TYPE.TOUCHDOWN_PASSING,
        qbId: 'qb-1',
        receiverId: 'receiver-1',
      }),
    ];

    expect(calculatePlayerStats(events, 'qb-1')).toMatchObject({
      passingTouchdowns: 1,
      receivingTouchdowns: 0,
    });
    expect(calculatePlayerStats(events, 'receiver-1')).toMatchObject({
      passingTouchdowns: 0,
      receivingTouchdowns: 1,
    });
  });

  it('zählt nur Events des angefragten Spielers', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, playerId: 'player-1' }),
      event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, playerId: 'player-2' }),
    ];
    expect(calculatePlayerStats(events, 'player-1').rushingTouchdowns).toBe(1);
  });

  it('verändert keine Statistik durch einen gegnerischen Touchdown', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, playerId: null }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toEqual(ZERO_STATS);
  });

  it('verändert keine Spielerstatistik durch TURNOVER_ON_DOWNS (nie ein Spieler, für kein Team)', () => {
    const events = [
      event({
        type: EVENT_TYPE.TURNOVER_ON_DOWNS,
        team: TEAM.PHOENIX,
        playerId: null,
        points: 0,
      }),
      event({
        type: EVENT_TYPE.TURNOVER_ON_DOWNS,
        team: TEAM.OPPONENT,
        playerId: null,
        points: 0,
      }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toEqual(ZERO_STATS);
  });

  it('summiert mehrere Touchdowns desselben Spielers', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, playerId: 'player-1' }),
      event({ type: EVENT_TYPE.TOUCHDOWN_PASSING, qbId: 'player-1', receiverId: 'receiver-1' }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toMatchObject({
      rushingTouchdowns: 1,
      passingTouchdowns: 1,
    });
  });

  it('zählt eine erfolgreiche eigene 1-Punkt-Conversion für den Spieler', () => {
    const events = [
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        playerId: 'player-1',
        successful: true,
        points: 1,
      }),
    ];
    expect(calculatePlayerStats(events, 'player-1').onePointConversions).toBe(1);
  });

  it('zählt eine erfolgreiche eigene 2-Punkt-Conversion für den Spieler', () => {
    const events = [
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        playerId: 'player-1',
        successful: true,
        points: 2,
      }),
    ];
    expect(calculatePlayerStats(events, 'player-1').twoPointConversions).toBe(1);
  });

  it('zählt keine fehlgeschlagene Conversion (keine Spielerreferenz vorhanden)', () => {
    const events = [
      event({
        type: EVENT_TYPE.CONVERSION_1PT,
        playerId: null,
        successful: false,
        points: 0,
      }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toMatchObject({
      onePointConversions: 0,
      twoPointConversions: 0,
    });
  });

  it('zählt keine gegnerische Conversion für einen eigenen Spieler', () => {
    const events = [
      event({
        type: EVENT_TYPE.CONVERSION_2PT,
        team: TEAM.OPPONENT,
        playerId: null,
        successful: true,
        points: 2,
      }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toMatchObject({
      onePointConversions: 0,
      twoPointConversions: 0,
    });
  });

  it('zählt First Down +1 für den erzielenden Spieler', () => {
    const events = [
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').firstDowns).toBe(1);
  });

  it('zählt mehrere First Downs desselben Spielers mehrfach', () => {
    const events = [
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').firstDowns).toBe(3);
  });

  it('rechnet einen First Down eines anderen Spielers nicht dem falschen Spieler zu', () => {
    const events = [
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-2', points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').firstDowns).toBe(0);
  });

  it('verändert durch einen gegnerischen First Down keine eigenen Spielerstatistiken', () => {
    const events = [
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.OPPONENT, playerId: null, points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').firstDowns).toBe(0);
  });

  it('zählt mehrere Interceptions desselben Spielers', () => {
    const events = [
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').interceptions).toBe(2);
  });

  it('rechnet eine Interception eines anderen Spielers nicht dem falschen Spieler zu', () => {
    const events = [
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'player-2', points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').interceptions).toBe(0);
  });

  it('verändert durch eine gegnerische Interception keine eigenen Spielerstatistiken', () => {
    const events = [
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.OPPONENT, playerId: null, points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').interceptions).toBe(0);
  });

  it('zählt Pick 6 als eigene pickSixes-Statistik, NICHT zusätzlich als Interception', () => {
    const events = [
      event({ type: EVENT_TYPE.PICK_6, team: TEAM.PHOENIX, playerId: 'player-1', points: 6 }),
    ];
    const stats = calculatePlayerStats(events, 'player-1');
    expect(stats.pickSixes).toBe(1);
    expect(stats.interceptions).toBe(0);
  });

  it('zählt Pick 2 als eigene pickTwos-Statistik, NICHT zusätzlich als Interception', () => {
    const events = [
      event({ type: EVENT_TYPE.PICK_2, team: TEAM.PHOENIX, playerId: 'player-1', points: 2 }),
    ];
    const stats = calculatePlayerStats(events, 'player-1');
    expect(stats.pickTwos).toBe(1);
    expect(stats.interceptions).toBe(0);
  });

  it('zählt Interception, Pick 6 und Pick 2 unabhängig voneinander für denselben Spieler', () => {
    const events = [
      event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.PICK_6, team: TEAM.PHOENIX, playerId: 'player-1', points: 6 }),
      event({ type: EVENT_TYPE.PICK_2, team: TEAM.PHOENIX, playerId: 'player-1', points: 2 }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toMatchObject({
      interceptions: 1,
      pickSixes: 1,
      pickTwos: 1,
    });
  });

  it('zählt mehrere Sacks desselben Spielers', () => {
    const events = [
      event({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
      event({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'player-2', points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').sacks).toBe(2);
  });

  it('verändert durch einen gegnerischen Sack keine eigenen Spielerstatistiken', () => {
    const events = [
      event({ type: EVENT_TYPE.SACK, team: TEAM.OPPONENT, playerId: null, points: 0 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').sacks).toBe(0);
  });

  it('zählt eine eigene Safety als safeties-Statistik', () => {
    const events = [
      event({ type: EVENT_TYPE.SAFETY, team: TEAM.PHOENIX, playerId: 'player-1', points: 2 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').safeties).toBe(1);
  });

  it('zählt eine eigene 1-Punkt-Safety als onePointSafeties-Statistik', () => {
    const events = [
      event({ type: EVENT_TYPE.SAFETY_1PT, team: TEAM.PHOENIX, playerId: 'player-1', points: 1 }),
    ];
    expect(calculatePlayerStats(events, 'player-1').onePointSafeties).toBe(1);
  });

  it('verändert durch eine gegnerische Safety/1-Punkt-Safety keine eigenen Spielerstatistiken', () => {
    const events = [
      event({ type: EVENT_TYPE.SAFETY, team: TEAM.OPPONENT, playerId: null, points: 2 }),
      event({ type: EVENT_TYPE.SAFETY_1PT, team: TEAM.OPPONENT, playerId: null, points: 1 }),
    ];
    expect(calculatePlayerStats(events, 'player-1')).toMatchObject({
      safeties: 0,
      onePointSafeties: 0,
    });
  });
});

describe('getParticipantPlayerIds', () => {
  it('gibt eine leere Liste bei keinen Events zurück', () => {
    expect(getParticipantPlayerIds([])).toEqual([]);
  });

  it('sammelt playerId aus Einzelspieler-Events', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, team: TEAM.PHOENIX, playerId: 'player-1' }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-2', points: 0 }),
    ];
    expect(getParticipantPlayerIds(events).sort()).toEqual(['player-1', 'player-2']);
  });

  it('sammelt qbId UND receiverId aus einem Passing-TD-Event', () => {
    const events = [
      event({
        type: EVENT_TYPE.TOUCHDOWN_PASSING,
        team: TEAM.PHOENIX,
        qbId: 'player-qb',
        receiverId: 'player-receiver',
      }),
    ];
    expect(getParticipantPlayerIds(events).sort()).toEqual(['player-qb', 'player-receiver']);
  });

  it('ignoriert Events ohne Spielerbezug (Gegner, Steuerungs-Events)', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, playerId: null }),
      event({ type: EVENT_TYPE.HALFTIME, team: null, playerId: null, points: 0 }),
    ];
    expect(getParticipantPlayerIds(events)).toEqual([]);
  });

  it('liefert jede Spieler-ID nur einmal, auch bei mehrfacher Teilnahme', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, team: TEAM.PHOENIX, playerId: 'player-1' }),
      event({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'player-1', points: 0 }),
    ];
    expect(getParticipantPlayerIds(events)).toEqual(['player-1']);
  });

  it('behandelt einen Spieler, der sowohl als Scorer als auch als QB auftritt, als eine ID', () => {
    const events = [
      event({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, team: TEAM.PHOENIX, playerId: 'player-1' }),
      event({
        type: EVENT_TYPE.TOUCHDOWN_PASSING,
        team: TEAM.PHOENIX,
        qbId: 'player-1',
        receiverId: 'player-2',
      }),
    ];
    expect(getParticipantPlayerIds(events).sort()).toEqual(['player-1', 'player-2']);
  });
});
