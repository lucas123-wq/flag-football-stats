import { describe, expect, it } from 'vitest';
import { assertValidEventInput, type CreateEventInput } from './eventValidation';
import { EVENT_TYPE, HALF, TEAM } from './types';

const baseGameId = 'game-1';

function valid(overrides: Partial<CreateEventInput>): CreateEventInput {
  return {
    gameId: baseGameId,
    type: EVENT_TYPE.FIRST_DOWN,
    team: TEAM.PHOENIX,
    playerId: 'player-1',
    points: 0,
    half: HALF.FIRST,
    ...overrides,
  };
}

describe('assertValidEventInput', () => {
  describe('Touchdown', () => {
    it('erlaubt Rushing TD mit Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, playerId: 'player-1', points: 6 }),
        ),
      ).not.toThrow();
    });

    it('verlangt einen Spieler bei Rushing TD', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, playerId: null, points: 6 }),
        ),
      ).toThrow(/playerId/);
    });

    it('verlangt QB und Receiver bei Passing TD', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TOUCHDOWN_PASSING,
            playerId: null,
            qbId: 'qb-1',
            receiverId: null,
            points: 6,
          }),
        ),
      ).toThrow(/qbId und receiverId/);
    });

    it('erlaubt Passing TD mit QB und Receiver', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TOUCHDOWN_PASSING,
            playerId: null,
            qbId: 'qb-1',
            receiverId: 'receiver-1',
            points: 6,
          }),
        ),
      ).not.toThrow();
    });

    it('lehnt QB gleich Receiver ab', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TOUCHDOWN_PASSING,
            playerId: null,
            qbId: 'player-1',
            receiverId: 'player-1',
            points: 6,
          }),
        ),
      ).toThrow(/unterschiedliche Spieler/);
    });

    it('lehnt Passing TD für den Gegner ab (Gegner nutzt TOUCHDOWN_OPPONENT)', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TOUCHDOWN_PASSING,
            team: TEAM.OPPONENT,
            playerId: null,
            qbId: 'qb-1',
            receiverId: 'receiver-1',
            points: 6,
          }),
        ),
      ).toThrow(/Regensburg Phoenix zulässig/);
    });

    it('gegnerischer Touchdown benötigt keinen Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
            team: TEAM.OPPONENT,
            playerId: null,
            points: 6,
          }),
        ),
      ).not.toThrow();
    });

    it('lehnt TOUCHDOWN_OPPONENT für das eigene Team ab', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
            team: TEAM.PHOENIX,
            playerId: null,
            points: 6,
          }),
        ),
      ).toThrow(/nur für den Gegner/);
    });
  });

  describe('Conversions', () => {
    it('verlangt einen Spieler bei erfolgreicher eigener Conversion', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.CONVERSION_1PT,
            playerId: null,
            successful: true,
            points: 1,
          }),
        ),
      ).toThrow(/playerId erforderlich/);
    });

    it('erlaubt erfolgreiche eigene Conversion mit Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.CONVERSION_1PT,
            playerId: 'player-1',
            successful: true,
            points: 1,
          }),
        ),
      ).not.toThrow();
    });

    it('lehnt Spieler bei nicht erfolgreicher eigener Conversion ab', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.CONVERSION_2PT,
            playerId: 'player-1',
            successful: false,
            points: 0,
          }),
        ),
      ).toThrow(/kein Spieler erfasst/);
    });

    it('erlaubt nicht erfolgreiche eigene Conversion ohne Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.CONVERSION_2PT,
            playerId: null,
            successful: false,
            points: 0,
          }),
        ),
      ).not.toThrow();
    });

    it('verlangt "successful" bei Conversions', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.CONVERSION_1PT,
            playerId: null,
            successful: null,
            points: 0,
          }),
        ),
      ).toThrow(/successful/);
    });

    it('gegnerische Conversion benötigt keinen Spieler, aber "successful"', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.CONVERSION_1PT,
            team: TEAM.OPPONENT,
            playerId: null,
            successful: true,
            points: 1,
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('Pick 6 / Pick 2 / Interception', () => {
    it('PICK_6 verlangt einen eigenen Spieler', () => {
      expect(() =>
        assertValidEventInput(valid({ type: EVENT_TYPE.PICK_6, playerId: null, points: 6 })),
      ).toThrow(/playerId/);
    });

    it('PICK_2 verlangt einen eigenen Spieler', () => {
      expect(() =>
        assertValidEventInput(valid({ type: EVENT_TYPE.PICK_2, playerId: null, points: 2 })),
      ).toThrow(/playerId/);
    });

    it('INTERCEPTION, PICK_6 und PICK_2 sind unabhängig gültig', () => {
      for (const type of [EVENT_TYPE.INTERCEPTION, EVENT_TYPE.PICK_6, EVENT_TYPE.PICK_2]) {
        expect(() =>
          assertValidEventInput(valid({ type, playerId: 'player-1', points: 0 })),
        ).not.toThrow();
      }
    });
  });

  describe('Turnover on Downs', () => {
    it('erlaubt ein eigenes Turnover-on-Downs-Event ohne Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, playerId: null, points: 0 }),
        ),
      ).not.toThrow();
    });

    it('lehnt einen Spieler beim eigenen Turnover-on-Downs-Event ab (anders als First Down/Interception/Sack)', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, playerId: 'player-1', points: 0 }),
        ),
      ).toThrow(/nie ein Spieler/);
    });

    it('erlaubt ein gegnerisches Turnover-on-Downs-Event ohne Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TURNOVER_ON_DOWNS,
            team: TEAM.OPPONENT,
            playerId: null,
            points: 0,
          }),
        ),
      ).not.toThrow();
    });

    it('lehnt einen Spieler beim gegnerischen Turnover-on-Downs-Event ab', () => {
      expect(() =>
        assertValidEventInput(
          valid({
            type: EVENT_TYPE.TURNOVER_ON_DOWNS,
            team: TEAM.OPPONENT,
            playerId: 'gegner-1',
            points: 0,
          }),
        ),
      ).toThrow(/bei gegnerischen Events/);
    });
  });

  describe('Gegnerische Events', () => {
    it('lehnt einen Spieler bei gegnerischem Event ab', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.SACK, team: TEAM.OPPONENT, playerId: 'gegner-1', points: 0 }),
        ),
      ).toThrow(/bei gegnerischen Events/);
    });

    it('erlaubt ein gegnerisches Event ohne Spieler', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.SACK, team: TEAM.OPPONENT, playerId: null, points: 0 }),
        ),
      ).not.toThrow();
    });
  });

  describe('Steuerungs-Events', () => {
    it('verlangt team = null', () => {
      expect(() =>
        assertValidEventInput(
          valid({ type: EVENT_TYPE.HALFTIME, team: TEAM.PHOENIX, playerId: null, points: 0 }),
        ),
      ).toThrow(/team muss null sein/);
    });

    it('erlaubt Halbzeit-/2-Min-Warning-/Spielende-Events ohne Team und Spieler', () => {
      for (const type of [
        EVENT_TYPE.TWO_MIN_WARNING,
        EVENT_TYPE.HALFTIME,
        EVENT_TYPE.SECOND_HALF_START,
        EVENT_TYPE.GAME_END,
      ]) {
        expect(() =>
          assertValidEventInput(valid({ type, team: null, playerId: null, points: 0 })),
        ).not.toThrow();
      }
    });
  });

  it('lehnt nicht-endliche points ab', () => {
    expect(() => assertValidEventInput(valid({ points: Number.NaN }))).toThrow(/points/);
  });
});
