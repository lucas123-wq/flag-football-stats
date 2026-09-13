import { assertValidEventInput } from './eventValidation';
import { assertValidGameInput } from './gameValidation';
import { assertValidPlayerInput } from './playerValidation';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from './types';
import type { EventType, GameStatus, Half, Team } from './types';
import type { Game, GameEvent, Player } from './types';

/**
 * Backup-/Restore-Format (PRD §5). Enthält die vollständige lokale
 * Datenbasis (Spieler, Spiele, Events) plus Versionierung und
 * Erstellungszeitpunkt als Metadaten – bewusst keine UI-/Anzeigedaten (z. B.
 * aktueller Tab, zuletzt angezeigte WhatsApp-Nachricht), da diese nicht Teil
 * der dauerhaften Datenbasis sind.
 *
 * `schemaVersion` erlaubt es künftigen App-Versionen, ältere Backups zu
 * erkennen und ggf. zu migrieren (PRD §5: "damit spätere App-Versionen alte
 * Backups möglichst weiterhin importieren können"). Für den MVP existiert
 * ausschließlich Version 1 – ein Import mit abweichender Version wird
 * abgelehnt statt eine Migration zu erfinden, die die PRD nicht vorgibt.
 */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  players: Player[];
  games: Game[];
  events: GameEvent[];
}

/** Baut ein Backup-Objekt aus den aktuell gespeicherten Daten (reine Funktion, kein I/O). */
export function buildBackup(players: Player[], games: Game[], events: GameEvent[]): BackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    players,
    games,
    events,
  };
}

/**
 * Dateiname für den Export. Die PRD gibt kein festes Namensschema vor –
 * gewählt wird ein sprechender, pro Export eindeutiger Name (Sekunden-genauer
 * Zeitstempel), Doppelpunkte durch Bindestriche ersetzt (in Dateinamen auf
 * manchen Dateisystemen ungültig).
 */
export function buildBackupFilename(date: Date): string {
  const timestamp = date.toISOString().replace(/:/g, '-').split('.')[0];
  return `regensburg-phoenix-backup-${timestamp}.json`;
}

const VALID_TEAMS: ReadonlySet<Team> = new Set(Object.values(TEAM));
const VALID_STATUSES: ReadonlySet<GameStatus> = new Set(Object.values(GAME_STATUS));
const VALID_EVENT_TYPES: ReadonlySet<EventType> = new Set(Object.values(EVENT_TYPE));

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Ungültiges Backup: ${path} ist kein gültiges Objekt.`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Ungültiges Backup: ${path} fehlt oder ist keine Liste.`);
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Ungültiges Backup: ${path} fehlt oder ist ungültig.`);
  }
  return value;
}

function expectNullableString(value: unknown, path: string): string | null {
  return value === null ? null : expectString(value, path);
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Ungültiges Backup: ${path} fehlt oder ist ungültig.`);
  }
  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Ungültiges Backup: ${path} fehlt oder ist ungültig.`);
  }
  return value;
}

function expectNullableBoolean(value: unknown, path: string): boolean | null {
  return value === null ? null : expectBoolean(value, path);
}

function expectIsoDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`Ungültiges Backup: ${path} fehlt oder ist kein gültiges Datum.`);
  }
  return value;
}

function expectEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, path: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`Ungültiges Backup: ${path} hat einen ungültigen Wert.`);
  }
  return value as T;
}

function expectNullableEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string,
): T | null {
  return value === null ? null : expectEnum(value, allowed, path);
}

function expectHalf(value: unknown, path: string): Half {
  if (value !== HALF.FIRST && value !== HALF.SECOND) {
    throw new Error(`Ungültiges Backup: ${path} hat einen ungültigen Wert.`);
  }
  return value;
}

function parseBackupPlayer(raw: unknown, index: number): Player {
  const p = expectRecord(raw, `players[${index}]`);
  return {
    id: expectString(p.id, `players[${index}].id`),
    firstName: expectString(p.firstName, `players[${index}].firstName`),
    lastName: expectString(p.lastName, `players[${index}].lastName`),
    jerseyNumber: expectNumber(p.jerseyNumber, `players[${index}].jerseyNumber`),
    active: expectBoolean(p.active, `players[${index}].active`),
    createdAt: expectIsoDate(p.createdAt, `players[${index}].createdAt`),
    updatedAt: expectIsoDate(p.updatedAt, `players[${index}].updatedAt`),
  };
}

function parseBackupGame(raw: unknown, index: number): Game {
  const g = expectRecord(raw, `games[${index}]`);
  return {
    id: expectString(g.id, `games[${index}].id`),
    opponent: expectString(g.opponent, `games[${index}].opponent`),
    date: expectString(g.date, `games[${index}].date`),
    status: expectEnum(g.status, VALID_STATUSES, `games[${index}].status`),
    createdAt: expectIsoDate(g.createdAt, `games[${index}].createdAt`),
    updatedAt: expectIsoDate(g.updatedAt, `games[${index}].updatedAt`),
  };
}

function parseBackupEvent(raw: unknown, index: number): GameEvent {
  const e = expectRecord(raw, `events[${index}]`);
  return {
    id: expectString(e.id, `events[${index}].id`),
    gameId: expectString(e.gameId, `events[${index}].gameId`),
    sequence: expectNumber(e.sequence, `events[${index}].sequence`),
    type: expectEnum(e.type, VALID_EVENT_TYPES, `events[${index}].type`),
    team: expectNullableEnum(e.team, VALID_TEAMS, `events[${index}].team`),
    playerId: expectNullableString(e.playerId, `events[${index}].playerId`),
    qbId: expectNullableString(e.qbId, `events[${index}].qbId`),
    receiverId: expectNullableString(e.receiverId, `events[${index}].receiverId`),
    successful: expectNullableBoolean(e.successful, `events[${index}].successful`),
    points: expectNumber(e.points, `events[${index}].points`),
    half: expectHalf(e.half, `events[${index}].half`),
    createdAt: expectIsoDate(e.createdAt, `events[${index}].createdAt`),
    updatedAt: expectIsoDate(e.updatedAt, `events[${index}].updatedAt`),
  };
}

/**
 * Parst und validiert ein Backup-JSON vollständig (PRD §5) – wirft bei JEDEM
 * Problem einen aussagekräftigen `Error`, bevor irgendetwas an den
 * Aufrufer zurückgegeben wird. Niemals ein teilweise gültiges Ergebnis.
 *
 * Prüft in dieser Reihenfolge:
 * 1. gültiges JSON
 * 2. Grundstruktur (schemaVersion, exportedAt, players/games/events als Listen)
 * 3. unterstützte Backup-Version
 * 4. je Datensatz: Pflichtfelder, Datentypen, gültige Enum-Werte
 * 5. eindeutige IDs je Tabelle
 * 6. Beziehungen (Event → Spiel, Event → Spieler)
 * 7. fachliche Konsistenz – nutzt bewusst dieselben Domain-Validatoren wie
 *    die normale Datenerfassung (`assertValidPlayerInput`/
 *    `assertValidGameInput`/`assertValidEventInput`), um keine zweite/
 *    parallele Validierungslogik zu pflegen.
 */
export function parseBackupJson(rawJson: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(rawJson);
  } catch {
    throw new Error('Ungültiges Backup: Die Datei enthält kein gültiges JSON.');
  }

  const candidate = expectRecord(data, 'Backup');

  const schemaVersion = expectNumber(candidate.schemaVersion, 'schemaVersion');
  if (schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Nicht unterstützte Backup-Version ${schemaVersion}. Unterstützt wird Version ${BACKUP_SCHEMA_VERSION}.`,
    );
  }
  const exportedAt = expectIsoDate(candidate.exportedAt, 'exportedAt');

  const rawPlayers = expectArray(candidate.players, 'players');
  const rawGames = expectArray(candidate.games, 'games');
  const rawEvents = expectArray(candidate.events, 'events');

  const players = rawPlayers.map((raw, index) => parseBackupPlayer(raw, index));
  const games = rawGames.map((raw, index) => parseBackupGame(raw, index));
  const events = rawEvents.map((raw, index) => parseBackupEvent(raw, index));

  const playerIds = new Set<string>();
  for (const player of players) {
    if (playerIds.has(player.id)) {
      throw new Error(`Ungültiges Backup: doppelte Spieler-ID "${player.id}".`);
    }
    playerIds.add(player.id);
  }
  for (const player of players) {
    assertValidPlayerInput(
      {
        firstName: player.firstName,
        lastName: player.lastName,
        jerseyNumber: player.jerseyNumber,
        active: player.active,
      },
      { existingPlayers: players.filter((other) => other.id !== player.id) },
    );
  }

  const gameIds = new Set<string>();
  for (const game of games) {
    if (gameIds.has(game.id)) {
      throw new Error(`Ungültiges Backup: doppelte Spiel-ID "${game.id}".`);
    }
    gameIds.add(game.id);
  }
  for (const game of games) {
    assertValidGameInput({ opponent: game.opponent, date: game.date });
  }

  const eventIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.id)) {
      throw new Error(`Ungültiges Backup: doppelte Event-ID "${event.id}".`);
    }
    eventIds.add(event.id);

    if (!gameIds.has(event.gameId)) {
      throw new Error(
        `Ungültiges Backup: Event "${event.id}" verweist auf unbekanntes Spiel "${event.gameId}".`,
      );
    }
    for (const [field, value] of [
      ['playerId', event.playerId],
      ['qbId', event.qbId],
      ['receiverId', event.receiverId],
    ] as const) {
      if (value !== null && !playerIds.has(value)) {
        throw new Error(
          `Ungültiges Backup: Event "${event.id}" verweist über ${field} auf unbekannten Spieler "${value}".`,
        );
      }
    }

    assertValidEventInput({
      gameId: event.gameId,
      type: event.type,
      team: event.team,
      playerId: event.playerId,
      qbId: event.qbId,
      receiverId: event.receiverId,
      successful: event.successful,
      points: event.points,
      half: event.half,
    });
  }

  return { schemaVersion, exportedAt, players, games, events };
}
