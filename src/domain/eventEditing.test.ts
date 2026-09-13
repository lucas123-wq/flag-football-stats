import { describe, expect, it } from 'vitest';
import { canDeleteEvent, canEditEvent, getEventEditKind } from './eventEditing';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from './types';
import type { Game, GameEvent } from './types';

let sequence = 0;
function makeEvent(overrides: Partial<GameEvent> & Pick<GameEvent, 'type'>): GameEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    gameId: 'game-1',
    sequence,
    team: null,
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

function makeGame(status: Game['status']): Game {
  return {
    id: 'game-1',
    opponent: 'Munich Cowboys',
    date: '2026-09-12',
    status,
    createdAt: '2026-09-12T09:00:00.000Z',
    updatedAt: '2026-09-12T09:00:00.000Z',
  };
}

describe('getEventEditKind', () => {
  it("gibt 'single-player' für eigene Einzelspieler-Events zurück", () => {
    const types = [
      EVENT_TYPE.TOUCHDOWN_RUSHING,
      EVENT_TYPE.FIRST_DOWN,
      EVENT_TYPE.INTERCEPTION,
      EVENT_TYPE.PICK_6,
      EVENT_TYPE.PICK_2,
      EVENT_TYPE.SACK,
      EVENT_TYPE.SAFETY,
      EVENT_TYPE.SAFETY_1PT,
    ];
    for (const type of types) {
      expect(getEventEditKind(makeEvent({ type, team: TEAM.PHOENIX }))).toBe('single-player');
    }
  });

  it('gibt null für die gegnerischen Varianten derselben Events zurück (kein Spielerfeld)', () => {
    const types = [
      EVENT_TYPE.FIRST_DOWN,
      EVENT_TYPE.INTERCEPTION,
      EVENT_TYPE.PICK_6,
      EVENT_TYPE.PICK_2,
      EVENT_TYPE.SACK,
      EVENT_TYPE.SAFETY,
      EVENT_TYPE.SAFETY_1PT,
    ];
    for (const type of types) {
      expect(getEventEditKind(makeEvent({ type, team: TEAM.OPPONENT }))).toBeNull();
    }
  });

  it('gibt null für TOUCHDOWN_OPPONENT zurück (kein editierbares Feld)', () => {
    expect(
      getEventEditKind(makeEvent({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT })),
    ).toBeNull();
  });

  it("gibt 'passing' für TOUCHDOWN_PASSING zurück", () => {
    expect(
      getEventEditKind(makeEvent({ type: EVENT_TYPE.TOUCHDOWN_PASSING, team: TEAM.PHOENIX })),
    ).toBe('passing');
  });

  it("gibt 'conversion' für CONVERSION_1PT/2PT unabhängig vom Team zurück", () => {
    expect(
      getEventEditKind(
        makeEvent({ type: EVENT_TYPE.CONVERSION_1PT, team: TEAM.PHOENIX, successful: true }),
      ),
    ).toBe('conversion');
    expect(
      getEventEditKind(
        makeEvent({ type: EVENT_TYPE.CONVERSION_2PT, team: TEAM.OPPONENT, successful: false }),
      ),
    ).toBe('conversion');
  });

  it('gibt null für TURNOVER_ON_DOWNS zurück, für beide Teams (nie ein Spieler)', () => {
    expect(
      getEventEditKind(makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX })),
    ).toBeNull();
    expect(
      getEventEditKind(makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT })),
    ).toBeNull();
  });

  it('gibt null für alle vier Steuerungs-Events zurück', () => {
    const types = [
      EVENT_TYPE.HALFTIME,
      EVENT_TYPE.SECOND_HALF_START,
      EVENT_TYPE.TWO_MIN_WARNING,
      EVENT_TYPE.GAME_END,
    ];
    for (const type of types) {
      expect(getEventEditKind(makeEvent({ type, team: null }))).toBeNull();
    }
  });
});

describe('canEditEvent', () => {
  it('ist nur bei FINAL erlaubt, wenn das Event ein editierbares Feld besitzt', () => {
    const event = makeEvent({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, team: TEAM.PHOENIX });
    expect(canEditEvent(makeGame(GAME_STATUS.FINAL), event)).toBe(true);
  });

  it.each([GAME_STATUS.LIVE_FIRST_HALF, GAME_STATUS.HALFTIME, GAME_STATUS.LIVE_SECOND_HALF])(
    'ist während %s NICHT erlaubt, auch wenn das Event editierbar wäre',
    (status) => {
      const event = makeEvent({ type: EVENT_TYPE.TOUCHDOWN_RUSHING, team: TEAM.PHOENIX });
      expect(canEditEvent(makeGame(status), event)).toBe(false);
    },
  );

  it('ist bei FINAL trotzdem NICHT erlaubt, wenn das Event kein editierbares Feld besitzt', () => {
    const event = makeEvent({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT });
    expect(canEditEvent(makeGame(GAME_STATUS.FINAL), event)).toBe(false);
  });

  it('ist bei FINAL für TURNOVER_ON_DOWNS NICHT erlaubt (kein editierbares Feld, für kein Team)', () => {
    expect(
      canEditEvent(
        makeGame(GAME_STATUS.FINAL),
        makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX }),
      ),
    ).toBe(false);
    expect(
      canEditEvent(
        makeGame(GAME_STATUS.FINAL),
        makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT }),
      ),
    ).toBe(false);
  });

  it('ist bei FINAL für alle vier Steuerungs-Events NICHT erlaubt', () => {
    const types = [
      EVENT_TYPE.HALFTIME,
      EVENT_TYPE.SECOND_HALF_START,
      EVENT_TYPE.TWO_MIN_WARNING,
      EVENT_TYPE.GAME_END,
    ];
    for (const type of types) {
      expect(canEditEvent(makeGame(GAME_STATUS.FINAL), makeEvent({ type, team: null }))).toBe(
        false,
      );
    }
  });
});

describe('canDeleteEvent', () => {
  it('ist bei FINAL für ein reguläres Event erlaubt', () => {
    const event = makeEvent({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT });
    expect(canDeleteEvent(makeGame(GAME_STATUS.FINAL), event)).toBe(true);
  });

  it('ist bei FINAL für TURNOVER_ON_DOWNS erlaubt, obwohl es nicht editierbar ist (kein Steuerungs-Event)', () => {
    const event = makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX });
    expect(canDeleteEvent(makeGame(GAME_STATUS.FINAL), event)).toBe(true);
  });

  it.each([GAME_STATUS.LIVE_FIRST_HALF, GAME_STATUS.HALFTIME, GAME_STATUS.LIVE_SECOND_HALF])(
    'ist während %s NICHT erlaubt',
    (status) => {
      const event = makeEvent({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT });
      expect(canDeleteEvent(makeGame(status), event)).toBe(false);
    },
  );

  it('ist bei FINAL für alle vier Steuerungs-Events NICHT erlaubt (schreibgeschützt)', () => {
    const types = [
      EVENT_TYPE.HALFTIME,
      EVENT_TYPE.SECOND_HALF_START,
      EVENT_TYPE.TWO_MIN_WARNING,
      EVENT_TYPE.GAME_END,
    ];
    for (const type of types) {
      expect(canDeleteEvent(makeGame(GAME_STATUS.FINAL), makeEvent({ type, team: null }))).toBe(
        false,
      );
    }
  });
});
