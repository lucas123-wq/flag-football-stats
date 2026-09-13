/**
 * Domain-Typen für Spieler, Spiel und Event.
 *
 * Enums werden bewusst als `const`-Objekte + abgeleitete Union-Typen modelliert
 * (statt TypeScript-`enum`): Die Werte sind so einfache Strings/Zahlen, die
 * verlustfrei in IndexedDB gespeichert und in Backups (JSON) exportiert werden
 * können, ohne dass eine separate Enum-Laufzeitrepräsentation nötig ist.
 */

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const TEAM = {
  PHOENIX: 'PHOENIX',
  OPPONENT: 'OPPONENT',
} as const;

export type Team = (typeof TEAM)[keyof typeof TEAM];

// ---------------------------------------------------------------------------
// Spielstatus (PRD §13)
// ---------------------------------------------------------------------------

export const GAME_STATUS = {
  LIVE_FIRST_HALF: 'LIVE_FIRST_HALF',
  HALFTIME: 'HALFTIME',
  LIVE_SECOND_HALF: 'LIVE_SECOND_HALF',
  FINAL: 'FINAL',
} as const;

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

// ---------------------------------------------------------------------------
// Halbzeit
// ---------------------------------------------------------------------------

export const HALF = {
  FIRST: 1,
  SECOND: 2,
} as const;

export type Half = (typeof HALF)[keyof typeof HALF];

// ---------------------------------------------------------------------------
// Eventtypen (PRD §17–§31)
// ---------------------------------------------------------------------------

export const EVENT_TYPE = {
  // Eigene Touchdowns werden nach Art unterschieden (PRD §17.2).
  TOUCHDOWN_RUSHING: 'TOUCHDOWN_RUSHING',
  TOUCHDOWN_PASSING: 'TOUCHDOWN_PASSING',
  // Gegnerische Touchdowns kennen laut PRD §17.3 keine Rushing/Passing-Unterscheidung.
  TOUCHDOWN_OPPONENT: 'TOUCHDOWN_OPPONENT',

  CONVERSION_1PT: 'CONVERSION_1PT',
  CONVERSION_2PT: 'CONVERSION_2PT',

  FIRST_DOWN: 'FIRST_DOWN',
  INTERCEPTION: 'INTERCEPTION',
  // Pick 6 / Pick 2 sind eigenständige Eventtypen (PRD §22/§23) – niemals
  // zusätzlich als INTERCEPTION zu speichern.
  PICK_6: 'PICK_6',
  PICK_2: 'PICK_2',
  SACK: 'SACK',
  SAFETY: 'SAFETY',
  SAFETY_1PT: 'SAFETY_1PT',
  // Turnover on Downs: wird dem Team gutgeschrieben, das den Ball erhält
  // (analog INTERCEPTION), erfasst aber NIE einen Spieler – für keins der
  // beiden Teams.
  TURNOVER_ON_DOWNS: 'TURNOVER_ON_DOWNS',

  // Steuerungs-Events (nicht team-/spielerbezogen).
  TWO_MIN_WARNING: 'TWO_MIN_WARNING',
  HALFTIME: 'HALFTIME',
  SECOND_HALF_START: 'SECOND_HALF_START',
  GAME_END: 'GAME_END',
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

/** Steuerungs-Events betreffen kein Team und keinen Spieler (PRD §27, §28, §30, §31). */
export const CONTROL_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  EVENT_TYPE.TWO_MIN_WARNING,
  EVENT_TYPE.HALFTIME,
  EVENT_TYPE.SECOND_HALF_START,
  EVENT_TYPE.GAME_END,
]);

/** Conversion-Events kennen ein "erfolgreich/nicht erfolgreich" (PRD §18, §19). */
export const CONVERSION_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  EVENT_TYPE.CONVERSION_1PT,
  EVENT_TYPE.CONVERSION_2PT,
]);

// ---------------------------------------------------------------------------
// Entitäten
// ---------------------------------------------------------------------------

/** Regensburg-Phoenix-Spieler (PRD §9). */
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  /** PRD §9.2: deaktivierte statt gelöschte Spieler, damit Events gültig bleiben. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Ein Spiel gehört immer zu genau einem Gegner (PRD §12). */
export interface Game {
  id: string;
  opponent: string;
  /** ISO-8601-Datum (yyyy-mm-dd). */
  date: string;
  status: GameStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ein Spielereignis. Dient laut PRD §35 als alleinige Quelle für Score,
 * Statistiken und Liveticker – Score/Statistik werden nicht redundant
 * gespeichert, sondern aus den Events abgeleitet (folgt in einem späteren
 * Schritt).
 *
 * Hinweis zur Benennung: Der Typ heißt bewusst `GameEvent` und nicht `Event`,
 * um keine Kollision mit dem globalen DOM-Typ `Event` zu erzeugen.
 */
export interface GameEvent {
  id: string;
  gameId: string;
  /**
   * Monotoner Zähler pro Spiel (technische Ergänzung ggü. PRD §32, dort
   * ausdrücklich erlaubt). `createdAt` allein reicht bei schneller Bedienung
   * ggf. nicht für eine stabile chronologische Reihenfolge im Liveticker.
   */
  sequence: number;
  type: EventType;
  /** `null` ausschließlich bei Steuerungs-Events. */
  team: Team | null;
  /**
   * Eigener Spieler des Events (z. B. Rushing TD, First Down, Interception, …).
   * Bei gegnerischen Events immer `null` – es existiert laut PRD §34 kein
   * Datenmodell für gegnerische Spieler.
   */
  playerId: string | null;
  /** Nur bei TOUCHDOWN_PASSING (eigener Quarterback). */
  qbId: string | null;
  /** Nur bei TOUCHDOWN_PASSING (eigener Receiver). */
  receiverId: string | null;
  /** Nur bei CONVERSION_1PT/CONVERSION_2PT relevant, sonst `null`. */
  successful: boolean | null;
  /** Punkteänderung durch dieses Event (kann 0 sein). */
  points: number;
  half: Half;
  createdAt: string;
  updatedAt: string;
}
