import { describe, expect, it } from 'vitest';
import { buildTickerEntries, recentTickerEntries } from './liveTicker';
import { EVENT_TYPE, HALF, TEAM } from './types';
import type { GameEvent, Player } from './types';

const OPPONENT_NAME = 'Munich Cowboys';

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

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'jerseyNumber'>): Player {
  return {
    firstName: 'Max',
    lastName: 'Mustermann',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const max = makePlayer({
  id: 'player-max',
  jerseyNumber: 12,
  firstName: 'Max',
  lastName: 'Mustermann',
});
const peter = makePlayer({
  id: 'player-peter',
  jerseyNumber: 7,
  firstName: 'Peter',
  lastName: 'Beispiel',
});

const players = new Map([
  [max.id, max],
  [peter.id, peter],
]);
const getPlayer = (id: string) => players.get(id);

describe('buildTickerEntries – Titel/Detail je Event-Typ', () => {
  it('Rushing TD (eigenes Team): Titel + Spieler, kein Spielstand', () => {
    const event = makeEvent({
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: max.id,
      points: 6,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('Touchdown Regensburg Phoenix');
    expect(entry?.detail).toBe('#12 Max Mustermann');
  });

  it('Passing TD: QB -> Receiver als Detail', () => {
    const event = makeEvent({
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: peter.id,
      receiverId: max.id,
      points: 6,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('Touchdown Regensburg Phoenix');
    expect(entry?.detail).toBe('#7 Peter Beispiel -> #12 Max Mustermann');
  });

  it('Gegnerischer Touchdown: nur Team-Zeile, kein Detail', () => {
    const event = makeEvent({
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      points: 6,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('Touchdown Munich Cowboys');
    expect(entry?.detail).toBeNull();
  });

  it('Erfolgreiche eigene Conversion: Spieler als Detail', () => {
    const event = makeEvent({
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.PHOENIX,
      playerId: peter.id,
      successful: true,
      points: 1,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('1-Punkt-Conversion Regensburg Phoenix');
    expect(entry?.detail).toBe('#7 Peter Beispiel');
  });

  it('Fehlgeschlagene eigene Conversion: "Fehlgeschlagen" als Detail, kein Spieler', () => {
    const event = makeEvent({
      type: EVENT_TYPE.CONVERSION_2PT,
      team: TEAM.PHOENIX,
      successful: false,
      points: 0,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('2-Punkt-Conversion Regensburg Phoenix');
    expect(entry?.detail).toBe('Fehlgeschlagen');
  });

  it('Erfolgreiche gegnerische Conversion: kein Detail (kein Spieler im Modell)', () => {
    const event = makeEvent({
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.OPPONENT,
      successful: true,
      points: 1,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('1-Punkt-Conversion Munich Cowboys');
    expect(entry?.detail).toBeNull();
  });

  it('Fehlgeschlagene gegnerische Conversion: "Fehlgeschlagen" als Detail', () => {
    const event = makeEvent({
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.OPPONENT,
      successful: false,
      points: 0,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.detail).toBe('Fehlgeschlagen');
  });

  it.each([
    [EVENT_TYPE.FIRST_DOWN, 'First Down'],
    [EVENT_TYPE.INTERCEPTION, 'Interception'],
    [EVENT_TYPE.SACK, 'Sack'],
  ])('%s (eigenes Team): Titel + Spieler, kein Spielstand', (type, label) => {
    const event = makeEvent({ type, team: TEAM.PHOENIX, playerId: max.id, points: 0 });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe(`${label} Regensburg Phoenix`);
    expect(entry?.detail).toBe('#12 Max Mustermann');
  });

  it.each([
    [EVENT_TYPE.FIRST_DOWN, 'First Down'],
    [EVENT_TYPE.INTERCEPTION, 'Interception'],
    [EVENT_TYPE.SACK, 'Sack'],
  ])('%s (Gegner): nur Team-Zeile, kein Detail', (type, label) => {
    const event = makeEvent({ type, team: TEAM.OPPONENT, points: 0 });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe(`${label} ${OPPONENT_NAME}`);
    expect(entry?.detail).toBeNull();
  });

  it.each([
    [EVENT_TYPE.PICK_6, 'Pick 6', 6],
    [EVENT_TYPE.PICK_2, 'Pick 2', 2],
  ])('%s (eigenes Team): Titel + Spieler', (type, label, points) => {
    const event = makeEvent({ type, team: TEAM.PHOENIX, playerId: max.id, points });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe(`${label} Regensburg Phoenix`);
    expect(entry?.detail).toBe('#12 Max Mustermann');
  });

  it.each([
    [EVENT_TYPE.SAFETY, 'Safety', 2],
    [EVENT_TYPE.SAFETY_1PT, '1-Punkt-Safety', 1],
  ])('%s (eigenes Team): Titel + Spieler', (type, label, points) => {
    const event = makeEvent({ type, team: TEAM.PHOENIX, playerId: max.id, points });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe(`${label} Regensburg Phoenix`);
    expect(entry?.detail).toBe('#12 Max Mustermann');
  });

  it('Turnover on Downs (eigenes Team): nur Team-Zeile, kein Detail (nie ein Spieler)', () => {
    const event = makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.PHOENIX, points: 0 });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe('Turnover on Downs Regensburg Phoenix');
    expect(entry?.detail).toBeNull();
  });

  it('Turnover on Downs (Gegner): nur Team-Zeile, kein Detail', () => {
    const event = makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT, points: 0 });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.title).toBe(`Turnover on Downs ${OPPONENT_NAME}`);
    expect(entry?.detail).toBeNull();
  });

  it('unbekannte Spieler-ID: Fallback-Text statt Absturz', () => {
    const event = makeEvent({
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: 'nicht-vorhanden',
      points: 0,
    });
    const [entry] = buildTickerEntries([event], OPPONENT_NAME, getPlayer);
    expect(entry?.detail).toBe('Unbekannter Spieler');
  });
});

describe('buildTickerEntries – Steuerungs-Events mit laufendem Spielstand', () => {
  it("zeigt für Halbzeit/Weiter geht's/2-Minuten/Spielende den zum Zeitpunkt gültigen Zwischenstand", () => {
    const events: GameEvent[] = [
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: max.id,
        points: 6,
      }),
      makeEvent({ type: EVENT_TYPE.HALFTIME, half: HALF.FIRST }),
      makeEvent({ type: EVENT_TYPE.SECOND_HALF_START, half: HALF.SECOND }),
      makeEvent({ type: EVENT_TYPE.TWO_MIN_WARNING, half: HALF.SECOND }),
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
        team: TEAM.OPPONENT,
        points: 6,
        half: HALF.SECOND,
      }),
      makeEvent({ type: EVENT_TYPE.GAME_END, half: HALF.SECOND }),
    ];

    const entries = buildTickerEntries(events, OPPONENT_NAME, getPlayer);

    expect(entries[1]).toMatchObject({
      title: 'Halbzeit',
      detail: 'Regensburg Phoenix 6:0 Munich Cowboys',
    });
    expect(entries[2]).toMatchObject({
      title: "Weiter geht's",
      detail: 'Regensburg Phoenix 6:0 Munich Cowboys',
    });
    expect(entries[3]).toMatchObject({
      title: '2-Minuten-Warnung',
      detail: 'Regensburg Phoenix 6:0 Munich Cowboys',
    });
    // Nach dem gegnerischen Touchdown (+6) hat sich der Zwischenstand geändert.
    expect(entries[5]).toMatchObject({
      title: 'Spielende',
      detail: 'Regensburg Phoenix 6:6 Munich Cowboys',
    });
  });

  it('Steuerungs-Events tragen selbst nie zum Spielstand bei (team: null, points: 0)', () => {
    const events: GameEvent[] = [
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: max.id,
        points: 6,
      }),
      makeEvent({ type: EVENT_TYPE.HALFTIME }),
      makeEvent({ type: EVENT_TYPE.GAME_END }),
    ];
    const entries = buildTickerEntries(events, OPPONENT_NAME, getPlayer);
    // Beide Steuerungs-Events zeigen denselben Stand wie nach dem Touchdown.
    expect(entries[1]?.detail).toBe('Regensburg Phoenix 6:0 Munich Cowboys');
    expect(entries[2]?.detail).toBe('Regensburg Phoenix 6:0 Munich Cowboys');
  });
});

describe('recentTickerEntries', () => {
  it('liefert die letzten `limit` Einträge, neueste zuerst', () => {
    const events: GameEvent[] = [
      makeEvent({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: max.id }),
      makeEvent({ type: EVENT_TYPE.SACK, team: TEAM.OPPONENT }),
      makeEvent({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, points: 6 }),
    ];
    const entries = buildTickerEntries(events, OPPONENT_NAME, getPlayer);
    const recent = recentTickerEntries(entries, 2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.event.type).toBe(EVENT_TYPE.TOUCHDOWN_OPPONENT);
    expect(recent[1]?.event.type).toBe(EVENT_TYPE.SACK);
  });

  it('liefert weniger als `limit`, wenn weniger Events vorhanden sind', () => {
    const events: GameEvent[] = [
      makeEvent({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: max.id }),
    ];
    const entries = buildTickerEntries(events, OPPONENT_NAME, getPlayer);
    expect(recentTickerEntries(entries, 3)).toHaveLength(1);
  });

  it('liefert ein leeres Array bei keinen Events', () => {
    expect(recentTickerEntries([], 3)).toEqual([]);
  });
});
