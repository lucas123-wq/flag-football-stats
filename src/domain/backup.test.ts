import { describe, expect, it } from 'vitest';
import { BACKUP_SCHEMA_VERSION, buildBackup, buildBackupFilename, parseBackupJson } from './backup';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from './types';
import type { Game, GameEvent, Player } from './types';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    firstName: 'Max',
    lastName: 'Mustermann',
    jerseyNumber: 12,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    opponent: 'Munich Cowboys',
    date: '2026-09-12',
    status: GAME_STATUS.FINAL,
    createdAt: '2026-09-12T09:00:00.000Z',
    updatedAt: '2026-09-12T11:00:00.000Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: 'event-1',
    gameId: 'game-1',
    sequence: 1,
    type: EVENT_TYPE.TOUCHDOWN_RUSHING,
    team: TEAM.PHOENIX,
    playerId: 'player-1',
    qbId: null,
    receiverId: null,
    successful: null,
    points: 6,
    half: HALF.FIRST,
    createdAt: '2026-09-12T09:05:00.000Z',
    updatedAt: '2026-09-12T09:05:00.000Z',
    ...overrides,
  };
}

describe('buildBackup', () => {
  it('setzt schemaVersion und einen gültigen exportedAt-Zeitstempel', () => {
    const backup = buildBackup([], [], []);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  });

  it('übernimmt Spieler/Spiele/Events unverändert (keine Transformation)', () => {
    const player = makePlayer();
    const game = makeGame();
    const event = makeEvent();
    const backup = buildBackup([player], [game], [event]);
    expect(backup.players).toEqual([player]);
    expect(backup.games).toEqual([game]);
    expect(backup.events).toEqual([event]);
  });

  it('funktioniert mit vollständig leeren Listen', () => {
    const backup = buildBackup([], [], []);
    expect(backup.players).toEqual([]);
    expect(backup.games).toEqual([]);
    expect(backup.events).toEqual([]);
  });
});

describe('buildBackupFilename', () => {
  it('erzeugt einen sprechenden, dateisystemsicheren Dateinamen ohne Doppelpunkte', () => {
    const filename = buildBackupFilename(new Date('2026-09-12T14:30:05.123Z'));
    expect(filename).toBe('regensburg-phoenix-backup-2026-09-12T14-30-05.json');
    expect(filename).not.toContain(':');
  });
});

describe('parseBackupJson – gültige Backups', () => {
  it('parst ein von buildBackup erzeugtes Backup verlustfrei (Roundtrip)', () => {
    const player = makePlayer();
    const game = makeGame();
    const event = makeEvent();
    const backup = buildBackup([player], [game], [event]);
    const json = JSON.stringify(backup);

    const parsed = parseBackupJson(json);
    expect(parsed).toEqual(backup);
  });

  it('parst ein Backup mit leerer Datenbasis', () => {
    const backup = buildBackup([], [], []);
    const parsed = parseBackupJson(JSON.stringify(backup));
    expect(parsed.players).toEqual([]);
    expect(parsed.games).toEqual([]);
    expect(parsed.events).toEqual([]);
  });

  it('akzeptiert mehrere Spieler/Spiele/Events mit korrekten Beziehungen', () => {
    const players = [
      makePlayer({ id: 'p1', jerseyNumber: 12 }),
      makePlayer({ id: 'p2', jerseyNumber: 7, firstName: 'Peter', lastName: 'Beispiel' }),
    ];
    const games = [makeGame({ id: 'g1' }), makeGame({ id: 'g2', opponent: 'Berlin Adler' })];
    const events = [
      makeEvent({ id: 'e1', gameId: 'g1', playerId: 'p1' }),
      makeEvent({
        id: 'e2',
        gameId: 'g1',
        type: EVENT_TYPE.TOUCHDOWN_PASSING,
        playerId: null,
        qbId: 'p1',
        receiverId: 'p2',
        sequence: 2,
      }),
      makeEvent({
        id: 'e3',
        gameId: 'g2',
        type: EVENT_TYPE.HALFTIME,
        team: null,
        playerId: null,
        points: 0,
      }),
    ];
    const backup = buildBackup(players, games, events);
    const parsed = parseBackupJson(JSON.stringify(backup));
    expect(parsed.players).toHaveLength(2);
    expect(parsed.games).toHaveLength(2);
    expect(parsed.events).toHaveLength(3);
  });
});

describe('parseBackupJson – ungültiges JSON', () => {
  it('wirft bei nicht-parsbarem Text', () => {
    expect(() => parseBackupJson('{ das ist kein json')).toThrow(/kein gültiges JSON/);
  });

  it('wirft bei einem JSON-Array statt einem Objekt', () => {
    expect(() => parseBackupJson('[]')).toThrow(/kein gültiges Objekt/);
  });

  it('wirft bei einem primitiven JSON-Wert', () => {
    expect(() => parseBackupJson('42')).toThrow(/kein gültiges Objekt/);
  });
});

describe('parseBackupJson – Backup-Version', () => {
  it('wirft bei fehlender schemaVersion', () => {
    const json = JSON.stringify({
      exportedAt: new Date().toISOString(),
      players: [],
      games: [],
      events: [],
    });
    expect(() => parseBackupJson(json)).toThrow(/schemaVersion/);
  });

  it('wirft bei nicht unterstützter (höherer) schemaVersion', () => {
    const backup = buildBackup([], [], []);
    const json = JSON.stringify({ ...backup, schemaVersion: 2 });
    expect(() => parseBackupJson(json)).toThrow(/Nicht unterstützte Backup-Version 2/);
  });

  it('wirft bei nicht unterstützter (niedrigerer) schemaVersion', () => {
    const backup = buildBackup([], [], []);
    const json = JSON.stringify({ ...backup, schemaVersion: 0 });
    expect(() => parseBackupJson(json)).toThrow(/Nicht unterstützte Backup-Version 0/);
  });
});

describe('parseBackupJson – Grundstruktur', () => {
  it('wirft bei fehlendem/ungültigem exportedAt', () => {
    const backup = buildBackup([], [], []);
    const json = JSON.stringify({ ...backup, exportedAt: 'kein-datum' });
    expect(() => parseBackupJson(json)).toThrow(/exportedAt/);
  });

  it('wirft, wenn players keine Liste ist', () => {
    const backup = buildBackup([], [], []);
    const json = JSON.stringify({ ...backup, players: {} });
    expect(() => parseBackupJson(json)).toThrow(/players/);
  });

  it('wirft, wenn games keine Liste ist', () => {
    const backup = buildBackup([], [], []);
    const json = JSON.stringify({ ...backup, games: 'nope' });
    expect(() => parseBackupJson(json)).toThrow(/games/);
  });

  it('wirft, wenn events keine Liste ist', () => {
    const backup = buildBackup([], [], []);
    const json = JSON.stringify({ ...backup, events: null });
    expect(() => parseBackupJson(json)).toThrow(/events/);
  });
});

describe('parseBackupJson – fehlende Pflichtfelder / falsche Datentypen', () => {
  it('wirft bei fehlendem Pflichtfeld eines Spielers (firstName)', () => {
    const player = makePlayer() as unknown as Record<string, unknown>;
    delete player.firstName;
    const backup = buildBackup([player as unknown as Player], [], []);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/players\[0\]\.firstName/);
  });

  it('wirft bei falschem Datentyp (jerseyNumber als String)', () => {
    const backup = buildBackup(
      [{ ...makePlayer(), jerseyNumber: '12' } as unknown as Player],
      [],
      [],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/jerseyNumber/);
  });

  it('wirft bei fehlendem Pflichtfeld eines Spiels (opponent)', () => {
    const game = makeGame() as unknown as Record<string, unknown>;
    delete game.opponent;
    const backup = buildBackup([], [game as unknown as Game], []);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/games\[0\]\.opponent/);
  });

  it('wirft bei fehlendem Pflichtfeld eines Events (id)', () => {
    const event = makeEvent() as unknown as Record<string, unknown>;
    delete event.id;
    const backup = buildBackup([makePlayer()], [makeGame()], [event as unknown as GameEvent]);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/events\[0\]\.id/);
  });
});

describe('parseBackupJson – ungültige Enum-Werte', () => {
  it('wirft bei ungültigem Spielstatus', () => {
    const backup = buildBackup([], [{ ...makeGame(), status: 'UNBEKANNT' } as unknown as Game], []);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/games\[0\]\.status/);
  });

  it('wirft bei ungültigem Event-Typ', () => {
    const backup = buildBackup(
      [makePlayer()],
      [makeGame()],
      [{ ...makeEvent(), type: 'UNBEKANNT' } as unknown as GameEvent],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/events\[0\]\.type/);
  });

  it('wirft bei ungültigem Team-Wert', () => {
    const backup = buildBackup(
      [makePlayer()],
      [makeGame()],
      [{ ...makeEvent(), team: 'GEGENTEAM' } as unknown as GameEvent],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/events\[0\]\.team/);
  });

  it('wirft bei ungültigem half-Wert', () => {
    const backup = buildBackup(
      [makePlayer()],
      [makeGame()],
      [{ ...makeEvent(), half: 3 } as unknown as GameEvent],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/events\[0\]\.half/);
  });
});

describe('parseBackupJson – doppelte IDs', () => {
  it('wirft bei doppelter Spieler-ID', () => {
    const backup = buildBackup(
      [makePlayer({ id: 'p1' }), makePlayer({ id: 'p1', jerseyNumber: 7 })],
      [],
      [],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/doppelte Spieler-ID/);
  });

  it('wirft bei doppelter Spiel-ID', () => {
    const backup = buildBackup(
      [],
      [makeGame({ id: 'g1' }), makeGame({ id: 'g1', opponent: 'Berlin Adler' })],
      [],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/doppelte Spiel-ID/);
  });

  it('wirft bei doppelter Event-ID', () => {
    const backup = buildBackup(
      [makePlayer()],
      [makeGame()],
      [makeEvent({ id: 'e1' }), makeEvent({ id: 'e1', sequence: 2 })],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/doppelte Event-ID/);
  });
});

describe('parseBackupJson – inkonsistente Beziehungen', () => {
  it('wirft, wenn ein Event auf ein unbekanntes Spiel verweist', () => {
    const backup = buildBackup([makePlayer()], [], [makeEvent({ gameId: 'nicht-vorhanden' })]);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/unbekanntes Spiel/);
  });

  it('wirft, wenn ein Event über playerId auf einen unbekannten Spieler verweist', () => {
    const backup = buildBackup([], [makeGame()], [makeEvent({ playerId: 'nicht-vorhanden' })]);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/unbekannten Spieler/);
  });

  it('wirft, wenn ein Passing-TD-Event über qbId auf einen unbekannten Spieler verweist', () => {
    const backup = buildBackup(
      [makePlayer({ id: 'p2' })],
      [makeGame()],
      [
        makeEvent({
          type: EVENT_TYPE.TOUCHDOWN_PASSING,
          playerId: null,
          qbId: 'nicht-vorhanden',
          receiverId: 'p2',
        }),
      ],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/unbekannten Spieler/);
  });
});

describe('parseBackupJson – fachliche Konsistenz (wiederverwendete Domain-Validatoren)', () => {
  it('wirft bei doppelter Trikotnummer unter zwei aktiven Spielern (assertValidPlayerInput)', () => {
    const backup = buildBackup(
      [
        makePlayer({ id: 'p1', jerseyNumber: 12, active: true }),
        makePlayer({ id: 'p2', jerseyNumber: 12, active: true, firstName: 'Peter' }),
      ],
      [],
      [],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/Trikotnummer/);
  });

  it('erlaubt dieselbe Trikotnummer, wenn ein Spieler inaktiv ist', () => {
    const backup = buildBackup(
      [
        makePlayer({ id: 'p1', jerseyNumber: 12, active: true }),
        makePlayer({ id: 'p2', jerseyNumber: 12, active: false, firstName: 'Peter' }),
      ],
      [],
      [],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).not.toThrow();
  });

  it('wirft bei einem reinen Leerzeichen-Gegnernamen (assertValidGameInput – die strukturelle Prüfung lässt einen nicht-leeren String durch, die fachliche Prüfung erkennt "nur Leerzeichen")', () => {
    const backup = buildBackup([], [makeGame({ opponent: '   ' })], []);
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/Gegnername/);
  });

  it('wirft bei einem Passing-TD ohne receiverId (assertValidEventInput)', () => {
    const backup = buildBackup(
      [makePlayer({ id: 'p1' })],
      [makeGame()],
      [
        makeEvent({
          type: EVENT_TYPE.TOUCHDOWN_PASSING,
          playerId: null,
          qbId: 'p1',
          receiverId: null,
        }),
      ],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/qbId und receiverId/);
  });

  it('wirft bei einer gegnerischen Interception mit erfasstem Spieler (assertValidEventInput)', () => {
    const backup = buildBackup(
      [makePlayer({ id: 'p1' })],
      [makeGame()],
      [
        makeEvent({
          type: EVENT_TYPE.INTERCEPTION,
          team: TEAM.OPPONENT,
          playerId: 'p1',
          points: 0,
        }),
      ],
    );
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow();
  });
});
