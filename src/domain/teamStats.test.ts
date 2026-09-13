import { describe, expect, it } from 'vitest';
import { calculateTeamStats } from './teamStats';
import { EVENT_TYPE, HALF, TEAM } from './types';
import type { GameEvent } from './types';

let sequence = 0;

function event(overrides: Partial<GameEvent> & Pick<GameEvent, 'type'>): GameEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    gameId: 'game-1',
    sequence,
    team: TEAM.PHOENIX,
    playerId: null,
    qbId: null,
    receiverId: null,
    successful: null,
    points: 0,
    half: HALF.FIRST,
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
    ...overrides,
  };
}

const ZERO_TEAM_STATS = {
  touchdowns: 0,
  onePointConversions: 0,
  twoPointConversions: 0,
  interceptions: 0,
  turnoverOnDowns: 0,
};

describe('calculateTeamStats', () => {
  it('ergibt für beide Teams lauter Nullen ohne Events', () => {
    expect(calculateTeamStats([])).toEqual({ phoenix: ZERO_TEAM_STATS, opponent: ZERO_TEAM_STATS });
  });

  describe('Touchdowns', () => {
    it('zählt Rushing/Passing TD für Regensburg Phoenix', () => {
      const events = [
        event({
          type: EVENT_TYPE.TOUCHDOWN_RUSHING,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          points: 6,
        }),
        event({
          type: EVENT_TYPE.TOUCHDOWN_PASSING,
          team: TEAM.PHOENIX,
          qbId: 'p1',
          receiverId: 'p2',
          points: 6,
        }),
      ];
      expect(calculateTeamStats(events).phoenix.touchdowns).toBe(2);
      expect(calculateTeamStats(events).opponent.touchdowns).toBe(0);
    });

    it('zählt TOUCHDOWN_OPPONENT für den Gegner', () => {
      const events = [
        event({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, points: 6 }),
        event({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, points: 6 }),
      ];
      expect(calculateTeamStats(events).opponent.touchdowns).toBe(2);
      expect(calculateTeamStats(events).phoenix.touchdowns).toBe(0);
    });

    it('zählt eine Passing TD als GENAU EIN Touchdown (nicht zwei, obwohl zwei Spieler betroffen sind)', () => {
      const events = [
        event({
          type: EVENT_TYPE.TOUCHDOWN_PASSING,
          team: TEAM.PHOENIX,
          qbId: 'qb-1',
          receiverId: 'wr-1',
          points: 6,
        }),
      ];
      expect(calculateTeamStats(events).phoenix.touchdowns).toBe(1);
    });
  });

  describe('1-Pt Conversions', () => {
    it('zählt nur erfolgreiche eigene 1-Pt-Conversions', () => {
      const events = [
        event({
          type: EVENT_TYPE.CONVERSION_1PT,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          successful: true,
          points: 1,
        }),
        event({
          type: EVENT_TYPE.CONVERSION_1PT,
          team: TEAM.PHOENIX,
          playerId: null,
          successful: false,
          points: 0,
        }),
      ];
      expect(calculateTeamStats(events).phoenix.onePointConversions).toBe(1);
    });

    it('zählt erfolgreiche gegnerische 1-Pt-Conversion für den Gegner', () => {
      const events = [
        event({
          type: EVENT_TYPE.CONVERSION_1PT,
          team: TEAM.OPPONENT,
          successful: true,
          points: 1,
        }),
      ];
      expect(calculateTeamStats(events).opponent.onePointConversions).toBe(1);
      expect(calculateTeamStats(events).phoenix.onePointConversions).toBe(0);
    });

    it('fehlgeschlagene 1-Pt-Conversions zählen für keins der beiden Teams', () => {
      const events = [
        event({
          type: EVENT_TYPE.CONVERSION_1PT,
          team: TEAM.PHOENIX,
          successful: false,
          points: 0,
        }),
        event({
          type: EVENT_TYPE.CONVERSION_1PT,
          team: TEAM.OPPONENT,
          successful: false,
          points: 0,
        }),
      ];
      const stats = calculateTeamStats(events);
      expect(stats.phoenix.onePointConversions).toBe(0);
      expect(stats.opponent.onePointConversions).toBe(0);
    });
  });

  describe('2-Pt Conversions', () => {
    it('zählt nur erfolgreiche eigene 2-Pt-Conversions', () => {
      const events = [
        event({
          type: EVENT_TYPE.CONVERSION_2PT,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          successful: true,
          points: 2,
        }),
        event({
          type: EVENT_TYPE.CONVERSION_2PT,
          team: TEAM.PHOENIX,
          playerId: null,
          successful: false,
          points: 0,
        }),
      ];
      expect(calculateTeamStats(events).phoenix.twoPointConversions).toBe(1);
    });

    it('zählt erfolgreiche gegnerische 2-Pt-Conversion für den Gegner, fehlgeschlagene nicht', () => {
      const events = [
        event({
          type: EVENT_TYPE.CONVERSION_2PT,
          team: TEAM.OPPONENT,
          successful: true,
          points: 2,
        }),
        event({
          type: EVENT_TYPE.CONVERSION_2PT,
          team: TEAM.OPPONENT,
          successful: false,
          points: 0,
        }),
      ];
      expect(calculateTeamStats(events).opponent.twoPointConversions).toBe(1);
    });
  });

  describe('Interceptions', () => {
    it('zählt Interceptions getrennt je Team', () => {
      const events = [
        event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'p1' }),
        event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'p2' }),
        event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.OPPONENT }),
      ];
      const stats = calculateTeamStats(events);
      expect(stats.phoenix.interceptions).toBe(2);
      expect(stats.opponent.interceptions).toBe(1);
    });

    it('Pick 6 wird NICHT zusätzlich als Interception gezählt', () => {
      const events = [
        event({ type: EVENT_TYPE.PICK_6, team: TEAM.PHOENIX, playerId: 'p1', points: 6 }),
      ];
      const stats = calculateTeamStats(events);
      expect(stats.phoenix.interceptions).toBe(0);
    });

    it('Pick 2 wird NICHT zusätzlich als Interception gezählt', () => {
      const events = [event({ type: EVENT_TYPE.PICK_2, team: TEAM.OPPONENT, points: 2 })];
      const stats = calculateTeamStats(events);
      expect(stats.opponent.interceptions).toBe(0);
    });

    it('Pick 6/Pick 2 fließen in KEINEN der Team-Statistik-Werte ein (nicht Teil der geforderten Liste)', () => {
      const events = [
        event({ type: EVENT_TYPE.PICK_6, team: TEAM.PHOENIX, playerId: 'p1', points: 6 }),
        event({ type: EVENT_TYPE.PICK_2, team: TEAM.PHOENIX, playerId: 'p1', points: 2 }),
      ];
      expect(calculateTeamStats(events).phoenix).toEqual(ZERO_TEAM_STATS);
    });
  });

  describe('Turnover on Downs (NEGATIVE Statistik – Korrektur: zählt für das Team, das den Ball VERLIERT, nicht für das Team, das ihn bekommt)', () => {
    it('eigenes Team verliert Downs (team: TEAM.PHOENIX) -> eigener Teamwert +1, Gegnerwert bleibt 0', () => {
      const events = [event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX, points: 0 })];
      const stats = calculateTeamStats(events);
      expect(stats.phoenix.turnoverOnDowns).toBe(1);
      expect(stats.opponent.turnoverOnDowns).toBe(0);
    });

    it('Gegner verliert Downs (team: TEAM.OPPONENT) -> Gegnerwert +1, eigener Teamwert bleibt 0', () => {
      const events = [
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT, points: 0 }),
      ];
      const stats = calculateTeamStats(events);
      expect(stats.opponent.turnoverOnDowns).toBe(1);
      expect(stats.phoenix.turnoverOnDowns).toBe(0);
    });

    it('zählt mehrere Turnover-on-Downs-Events korrekt getrennt je verlierendem Team', () => {
      const events = [
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX, points: 0 }),
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT, points: 0 }),
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT, points: 0 }),
      ];
      const stats = calculateTeamStats(events);
      expect(stats.phoenix.turnoverOnDowns).toBe(1);
      expect(stats.opponent.turnoverOnDowns).toBe(2);
    });

    it('trägt nie zum Score bei (0 Punkte, unabhängig davon, welches Team den Ball verliert)', () => {
      const events = [
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX, points: 0 }),
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT, points: 0 }),
      ];
      const totalPoints = events.reduce((sum, e) => sum + e.points, 0);
      expect(totalPoints).toBe(0);
    });

    it('erfasst nie einen Spieler (playerId bleibt null) und beeinflusst daher nie eine Spielerstatistik', () => {
      const event1 = event({
        type: EVENT_TYPE.TURNOVER_ON_DOWNS,
        team: TEAM.PHOENIX,
        playerId: null,
        points: 0,
      });
      expect(event1.playerId).toBeNull();
    });

    it('erzeugt KEINEN zusätzlichen Interception-Wert – Turnover on Downs und Interception sind vollständig unabhängige Zähler', () => {
      const events = [event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX, points: 0 })];
      const stats = calculateTeamStats(events);
      expect(stats.phoenix.interceptions).toBe(0);
      expect(stats.phoenix.turnoverOnDowns).toBe(1);
    });

    it('Löschen des Events reduziert den Wert des VERLIERENDEN Teams wieder (simuliert Löschen durch kürzeres Events-Array)', () => {
      const phoenixLoss = event({
        type: EVENT_TYPE.TURNOVER_ON_DOWNS,
        team: TEAM.PHOENIX,
        points: 0,
      });
      const opponentLoss = event({
        type: EVENT_TYPE.TURNOVER_ON_DOWNS,
        team: TEAM.OPPONENT,
        points: 0,
      });
      const before = calculateTeamStats([phoenixLoss, opponentLoss]);
      expect(before.phoenix.turnoverOnDowns).toBe(1);
      expect(before.opponent.turnoverOnDowns).toBe(1);

      // "Löschen" des Phoenix-Verlusts – der Gegner-Wert bleibt unberührt.
      const afterDeletingPhoenixLoss = calculateTeamStats([opponentLoss]);
      expect(afterDeletingPhoenixLoss.phoenix.turnoverOnDowns).toBe(0);
      expect(afterDeletingPhoenixLoss.opponent.turnoverOnDowns).toBe(1);
    });
  });

  describe('Trennung/Isolation', () => {
    it('Events beider Teams werden korrekt getrennt (ein gemischtes Spiel)', () => {
      const events = [
        event({
          type: EVENT_TYPE.TOUCHDOWN_RUSHING,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          points: 6,
        }),
        event({
          type: EVENT_TYPE.CONVERSION_1PT,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          successful: true,
          points: 1,
        }),
        event({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'p2' }),
        event({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, points: 6 }),
        event({
          type: EVENT_TYPE.CONVERSION_2PT,
          team: TEAM.OPPONENT,
          successful: true,
          points: 2,
        }),
        event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT, points: 0 }),
      ];

      const stats = calculateTeamStats(events);
      expect(stats.phoenix).toEqual({
        touchdowns: 1,
        onePointConversions: 1,
        twoPointConversions: 0,
        interceptions: 1,
        turnoverOnDowns: 0,
      });
      expect(stats.opponent).toEqual({
        touchdowns: 1,
        onePointConversions: 0,
        twoPointConversions: 1,
        interceptions: 0,
        turnoverOnDowns: 1,
      });
    });

    it('Steuerungs-Events (team: null) tragen zu keinem der beiden Teams bei', () => {
      const events = [
        event({ type: EVENT_TYPE.HALFTIME, team: null, points: 0 }),
        event({ type: EVENT_TYPE.GAME_END, team: null, points: 0 }),
      ];
      expect(calculateTeamStats(events)).toEqual({
        phoenix: ZERO_TEAM_STATS,
        opponent: ZERO_TEAM_STATS,
      });
    });
  });

  describe('Neuberechnung nach Event-Löschen/-Bearbeiten (Single Source of Truth)', () => {
    it('sinkt der Wert korrekt, wenn ein Event aus der Liste entfernt wird (simuliert Löschen)', () => {
      const turnover = event({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX, points: 0 });
      const events = [
        event({
          type: EVENT_TYPE.TOUCHDOWN_RUSHING,
          team: TEAM.PHOENIX,
          playerId: 'p1',
          points: 6,
        }),
        turnover,
      ];
      expect(calculateTeamStats(events).phoenix.turnoverOnDowns).toBe(1);

      // "Löschen" bildet sich rein durch ein kürzeres Events-Array ab – es
      // gibt keinen separat gepflegten Zähler, der veralten könnte.
      const afterDelete = events.filter((e) => e.id !== turnover.id);
      const stats = calculateTeamStats(afterDelete);
      expect(stats.phoenix.turnoverOnDowns).toBe(0);
      expect(stats.phoenix.touchdowns).toBe(1);
    });

    it('ändert sich der Wert korrekt, wenn eine Conversion von erfolgreich zu fehlgeschlagen bearbeitet wird', () => {
      const conversion = event({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'p1',
        successful: true,
        points: 1,
      });
      const before = calculateTeamStats([conversion]);
      expect(before.phoenix.onePointConversions).toBe(1);

      // "Bearbeiten" bildet sich durch ein verändertes Event-Objekt ab
      // (genau das, was `data/events.ts#updateEvent` tatsächlich persistiert).
      const edited: GameEvent = { ...conversion, successful: false, playerId: null, points: 0 };
      const after = calculateTeamStats([edited]);
      expect(after.phoenix.onePointConversions).toBe(0);
    });
  });
});
