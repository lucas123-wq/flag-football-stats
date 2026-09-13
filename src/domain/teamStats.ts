import { EVENT_TYPE, TEAM } from './types';
import type { GameEvent } from './types';

/**
 * Team-Gesamtstatistik für ein Spiel (Ergänzung zu `stats.ts`, das
 * Spieler-Statistiken berechnet). Bewusst ein eigenes Modul statt einer
 * Erweiterung von `stats.ts`, um die bestehende, bereits umfassend getestete
 * Spielerstatistik-Berechnung unangetastet zu lassen – beide Module leiten
 * unabhängig voneinander aus denselben Events ab (PRD §35, Single Source of
 * Truth: keine der beiden Statistiken wird redundant gespeichert).
 */
export interface TeamStats {
  touchdowns: number;
  onePointConversions: number;
  twoPointConversions: number;
  interceptions: number;
  /**
   * NEGATIVE Statistik: Anzahl der Turnover on Downs, die DIESES Team
   * verloren hat (eigene Offense scheitert am First Down) – nicht die
   * Anzahl, die es durch gegnerisches Scheitern gewonnen hat. Siehe
   * `turnoverOnDowns.ts` für die genaue Zuordnungsregel.
   */
  turnoverOnDowns: number;
}

export interface TeamStatsByTeam {
  phoenix: TeamStats;
  opponent: TeamStats;
}

function emptyTeamStats(): TeamStats {
  return {
    touchdowns: 0,
    onePointConversions: 0,
    twoPointConversions: 0,
    interceptions: 0,
    turnoverOnDowns: 0,
  };
}

const TOUCHDOWN_TYPES: ReadonlySet<string> = new Set([
  EVENT_TYPE.TOUCHDOWN_RUSHING,
  EVENT_TYPE.TOUCHDOWN_PASSING,
  EVENT_TYPE.TOUCHDOWN_OPPONENT,
]);

/**
 * Berechnet die Team-Gesamtstatistik für BEIDE Teams ausschließlich aus den
 * gespeicherten Events (PRD §35, Single Source of Truth) – keine
 * redundante Speicherung, automatisch korrekt nach Bearbeiten/Löschen eines
 * Events.
 *
 * - Touchdowns: `TOUCHDOWN_RUSHING`/`TOUCHDOWN_PASSING` (ein Event = ein
 *   Touchdown, unabhängig davon, dass ein Passing TD zwei Spieler betrifft)
 *   sowie `TOUCHDOWN_OPPONENT` (zählt für den Gegner, ergibt sich direkt aus
 *   `event.team`, keine Sonderbehandlung nötig).
 * - 1-/2-Pt Conversions: nur erfolgreiche (`successful === true`) zählen.
 * - Interceptions: ausschließlich `INTERCEPTION` – `PICK_6`/`PICK_2` sind
 *   eigenständige Events (PRD §22/§23) und zählen hier bewusst NICHT
 *   zusätzlich mit, analog zu `stats.ts#calculatePlayerStats`.
 * - Turnover on Downs: `TURNOVER_ON_DOWNS` – NEGATIVE Statistik, zählt für
 *   das Team, das den Ball verliert (`event.team`), siehe `turnoverOnDowns.ts`.
 *
 * Jeder Wert wird direkt über `event.team` dem passenden Team zugeordnet –
 * Steuerungs-Events (`team === null`) tragen zu keinem der beiden Werte bei.
 */
export function calculateTeamStats(events: GameEvent[]): TeamStatsByTeam {
  const phoenix = emptyTeamStats();
  const opponent = emptyTeamStats();

  for (const event of events) {
    if (event.team !== TEAM.PHOENIX && event.team !== TEAM.OPPONENT) {
      continue;
    }
    const target = event.team === TEAM.PHOENIX ? phoenix : opponent;

    if (TOUCHDOWN_TYPES.has(event.type)) {
      target.touchdowns += 1;
    } else if (event.type === EVENT_TYPE.CONVERSION_1PT && event.successful) {
      target.onePointConversions += 1;
    } else if (event.type === EVENT_TYPE.CONVERSION_2PT && event.successful) {
      target.twoPointConversions += 1;
    } else if (event.type === EVENT_TYPE.INTERCEPTION) {
      target.interceptions += 1;
    } else if (event.type === EVENT_TYPE.TURNOVER_ON_DOWNS) {
      target.turnoverOnDowns += 1;
    }
  }

  return { phoenix, opponent };
}
