import { describe, expect, it } from 'vitest';
import {
  buildGameEndEvent,
  buildHalftimeEvent,
  buildSecondHalfStartEvent,
  buildTwoMinuteWarningEvent,
  canFinishGame,
  canRecordEvents,
  canResumeSecondHalf,
  canStartHalftime,
  canTriggerTwoMinuteWarning,
  formatGameEndMessage,
  formatHalftimeMessage,
  formatSecondHalfStartMessage,
  formatTwoMinuteWarningMessage,
} from './gameFlow';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from './types';

const ALL_STATUSES = [
  GAME_STATUS.LIVE_FIRST_HALF,
  GAME_STATUS.HALFTIME,
  GAME_STATUS.LIVE_SECOND_HALF,
  GAME_STATUS.FINAL,
];

describe('canRecordEvents', () => {
  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, true],
    [GAME_STATUS.HALFTIME, false],
    [GAME_STATUS.LIVE_SECOND_HALF, true],
    [GAME_STATUS.FINAL, false],
  ])('%s -> %s', (status, expected) => {
    expect(canRecordEvents(status)).toBe(expected);
  });
});

describe('canStartHalftime (erlaubte/ungültige Übergänge)', () => {
  it('ist nur während LIVE_FIRST_HALF erlaubt', () => {
    expect(canStartHalftime(GAME_STATUS.LIVE_FIRST_HALF)).toBe(true);
  });

  it.each(ALL_STATUSES.filter((s) => s !== GAME_STATUS.LIVE_FIRST_HALF))(
    'ist während %s NICHT erlaubt',
    (status) => {
      expect(canStartHalftime(status)).toBe(false);
    },
  );
});

describe('canResumeSecondHalf (erlaubte/ungültige Übergänge)', () => {
  it('ist nur während HALFTIME erlaubt', () => {
    expect(canResumeSecondHalf(GAME_STATUS.HALFTIME)).toBe(true);
  });

  it.each(ALL_STATUSES.filter((s) => s !== GAME_STATUS.HALFTIME))(
    'ist während %s NICHT erlaubt (insb. nicht direkt LIVE_SECOND_HALF -> HALFTIME rückwärts)',
    (status) => {
      expect(canResumeSecondHalf(status)).toBe(false);
    },
  );
});

describe('canFinishGame (erlaubte/ungültige Übergänge)', () => {
  it('ist nur während LIVE_SECOND_HALF erlaubt', () => {
    expect(canFinishGame(GAME_STATUS.LIVE_SECOND_HALF)).toBe(true);
  });

  it('ist während HALFTIME NICHT erlaubt (kein direkter Sprung HALFTIME -> FINAL)', () => {
    expect(canFinishGame(GAME_STATUS.HALFTIME)).toBe(false);
  });

  it('ist während LIVE_FIRST_HALF NICHT erlaubt', () => {
    expect(canFinishGame(GAME_STATUS.LIVE_FIRST_HALF)).toBe(false);
  });

  it('ist während FINAL NICHT erlaubt (FINAL darf nicht erneut beendet werden)', () => {
    expect(canFinishGame(GAME_STATUS.FINAL)).toBe(false);
  });
});

describe('canTriggerTwoMinuteWarning', () => {
  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, true],
    [GAME_STATUS.HALFTIME, false],
    [GAME_STATUS.LIVE_SECOND_HALF, true],
    [GAME_STATUS.FINAL, false],
  ])('%s -> %s', (status, expected) => {
    expect(canTriggerTwoMinuteWarning(status)).toBe(expected);
  });
});

describe('buildHalftimeEvent', () => {
  it('erzeugt ein Steuerungs-Event vom Typ HALFTIME ohne Team/Spieler/Punkte', () => {
    const input = buildHalftimeEvent({ gameId: 'game-1', half: HALF.FIRST });

    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.HALFTIME,
      team: null,
      points: 0,
      half: HALF.FIRST,
    });
  });
});

describe('buildSecondHalfStartEvent', () => {
  it('erzeugt ein Steuerungs-Event vom Typ SECOND_HALF_START ohne Team/Spieler/Punkte', () => {
    const input = buildSecondHalfStartEvent({ gameId: 'game-1', half: HALF.SECOND });

    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.SECOND_HALF_START,
      team: null,
      points: 0,
      half: HALF.SECOND,
    });
  });
});

describe('buildTwoMinuteWarningEvent', () => {
  it('erzeugt ein Steuerungs-Event vom Typ TWO_MIN_WARNING ohne Team/Spieler/Punkte', () => {
    const input = buildTwoMinuteWarningEvent({ gameId: 'game-1', half: HALF.SECOND });

    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.TWO_MIN_WARNING,
      team: null,
      points: 0,
      half: HALF.SECOND,
    });
  });
});

describe('buildGameEndEvent', () => {
  it('erzeugt ein Steuerungs-Event vom Typ GAME_END ohne Team/Spieler/Punkte', () => {
    const input = buildGameEndEvent({ gameId: 'game-1', half: HALF.SECOND });

    expect(input).toEqual({
      gameId: 'game-1',
      type: EVENT_TYPE.GAME_END,
      team: null,
      points: 0,
      half: HALF.SECOND,
    });
  });
});

describe('Steuerungs-Events sind team-neutral (PRD §27/§28/§30/§31)', () => {
  it.each([
    ['buildHalftimeEvent', buildHalftimeEvent({ gameId: 'g', half: HALF.FIRST })],
    ['buildSecondHalfStartEvent', buildSecondHalfStartEvent({ gameId: 'g', half: HALF.SECOND })],
    ['buildTwoMinuteWarningEvent', buildTwoMinuteWarningEvent({ gameId: 'g', half: HALF.FIRST })],
    ['buildGameEndEvent', buildGameEndEvent({ gameId: 'g', half: HALF.SECOND })],
  ])('%s: team ist null, points ist 0 (kein PHOENIX/OPPONENT, kein Score-Einfluss)', (_, input) => {
    expect(input.team).toBeNull();
    expect(input.team).not.toBe(TEAM.PHOENIX);
    expect(input.team).not.toBe(TEAM.OPPONENT);
    expect(input.points).toBe(0);
  });
});

describe('formatHalftimeMessage', () => {
  it('folgt exakt dem PRD-Wortlaut aus §28 ("Team X:Y Team", kein "Spielstand:"-Präfix)', () => {
    const message = formatHalftimeMessage({
      opponentName: 'Munich Cowboys',
      score: { phoenix: 12, opponent: 6 },
    });
    expect(message).toBe('Halbzeit\nRegensburg Phoenix 12:6 Munich Cowboys');
  });
});

describe('formatTwoMinuteWarningMessage', () => {
  it('folgt exakt dem PRD-Wortlaut aus §27 ("Spielstand:"-Format)', () => {
    const message = formatTwoMinuteWarningMessage({ score: { phoenix: 6, opponent: 0 } });
    expect(message).toBe('2-Minuten-Warnung\nSpielstand: 6:0');
  });
});

describe('formatSecondHalfStartMessage', () => {
  it('folgt exakt dem PRD-Wortlaut aus §30 (kein "Spielstand:"-Format)', () => {
    const message = formatSecondHalfStartMessage({
      opponentName: 'Munich Cowboys',
      score: { phoenix: 12, opponent: 6 },
    });
    expect(message).toBe("Weiter geht's\nRegensburg Phoenix 12:6 Munich Cowboys");
  });
});

describe('formatGameEndMessage', () => {
  it('folgt exakt dem PRD-Wortlaut aus §31 ("Team X:Y Team", kein "Endstand:"-Präfix)', () => {
    const message = formatGameEndMessage({
      opponentName: 'Munich Cowboys',
      score: { phoenix: 20, opponent: 14 },
    });
    expect(message).toBe('Spielende\nRegensburg Phoenix 20:14 Munich Cowboys');
  });
});
