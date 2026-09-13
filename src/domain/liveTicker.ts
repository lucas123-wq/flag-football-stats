import { formatPlayerLabel } from './touchdown';
import { EVENT_TYPE, TEAM } from './types';
import type { GameEvent, Player } from './types';
import type { Score } from './scoring';

/**
 * Kompakte, eigenständige Darstellung für Liveticker (PRD §39) und "Letzte
 * Events" (PRD §36). Bewusst KEINE Wiederverwendung der WhatsApp-Texte aus
 * `touchdown.ts`/`conversion.ts`/etc. (`format*Message`-Funktionen) – die
 * Ticker-Darstellung ist eine eigene, von WhatsApp unabhängige Formatierung
 * ohne "Neuer Spielstand:"-Zeilen. Für Scoring-Events (Touchdown, Conversion,
 * Pick 6/2, Safety) wird – wie im PRD-Beispiel §39 – bewusst KEIN Spielstand
 * angezeigt; für die vier Steuerungs-Events (Halbzeit/Weiter geht's/
 * 2-Minuten-Warnung/Spielende) wird der zum Zeitpunkt des Events gültige
 * laufende Spielstand angezeigt (analog zu den PRD-Beispielen für Halbzeit/
 * Weiter geht's/Spielende in §39, hier zusätzlich konsistent auch für die
 * 2-Minuten-Warnung, da die PRD dafür kein Ticker-Beispiel vorgibt).
 */

export interface TickerEntry {
  event: GameEvent;
  title: string;
  /** Zweite Zeile (Spieler/Spielstand) oder `null`, wenn keine vorhanden ist. */
  detail: string | null;
}

/** Löst eine Spieler-ID über eine beliebige Lookup-Quelle (z. B. `Map`) auf. */
export type PlayerLookup = (playerId: string) => Player | undefined;

function playerLabel(playerId: string | null, getPlayer: PlayerLookup): string {
  if (!playerId) {
    return 'Unbekannter Spieler';
  }
  const player = getPlayer(playerId);
  return player ? formatPlayerLabel(player) : 'Unbekannter Spieler';
}

function describeEvent(
  event: GameEvent,
  opponentName: string,
  getPlayer: PlayerLookup,
  runningScore: Score,
): { title: string; detail: string | null } {
  switch (event.type) {
    case EVENT_TYPE.TOUCHDOWN_RUSHING:
      return {
        title: 'Touchdown Regensburg Phoenix',
        detail: playerLabel(event.playerId, getPlayer),
      };
    case EVENT_TYPE.TOUCHDOWN_PASSING:
      return {
        title: 'Touchdown Regensburg Phoenix',
        detail: `${playerLabel(event.qbId, getPlayer)} -> ${playerLabel(event.receiverId, getPlayer)}`,
      };
    case EVENT_TYPE.TOUCHDOWN_OPPONENT:
      return { title: `Touchdown ${opponentName}`, detail: null };

    case EVENT_TYPE.CONVERSION_1PT:
    case EVENT_TYPE.CONVERSION_2PT: {
      const label =
        event.type === EVENT_TYPE.CONVERSION_1PT ? '1-Punkt-Conversion' : '2-Punkt-Conversion';
      const teamName = event.team === TEAM.PHOENIX ? 'Regensburg Phoenix' : opponentName;
      if (!event.successful) {
        return { title: `${label} ${teamName}`, detail: 'Fehlgeschlagen' };
      }
      return {
        title: `${label} ${teamName}`,
        detail: event.team === TEAM.PHOENIX ? playerLabel(event.playerId, getPlayer) : null,
      };
    }

    case EVENT_TYPE.FIRST_DOWN:
      return event.team === TEAM.PHOENIX
        ? { title: 'First Down Regensburg Phoenix', detail: playerLabel(event.playerId, getPlayer) }
        : { title: `First Down ${opponentName}`, detail: null };

    case EVENT_TYPE.INTERCEPTION:
      return event.team === TEAM.PHOENIX
        ? {
            title: 'Interception Regensburg Phoenix',
            detail: playerLabel(event.playerId, getPlayer),
          }
        : { title: `Interception ${opponentName}`, detail: null };

    case EVENT_TYPE.PICK_6:
    case EVENT_TYPE.PICK_2: {
      const label = event.type === EVENT_TYPE.PICK_6 ? 'Pick 6' : 'Pick 2';
      return event.team === TEAM.PHOENIX
        ? { title: `${label} Regensburg Phoenix`, detail: playerLabel(event.playerId, getPlayer) }
        : { title: `${label} ${opponentName}`, detail: null };
    }

    case EVENT_TYPE.SACK:
      return event.team === TEAM.PHOENIX
        ? { title: 'Sack Regensburg Phoenix', detail: playerLabel(event.playerId, getPlayer) }
        : { title: `Sack ${opponentName}`, detail: null };

    case EVENT_TYPE.TURNOVER_ON_DOWNS:
      // Nie ein Spieler (für kein Team) -> nur ein Titel, keine Detailzeile.
      return event.team === TEAM.PHOENIX
        ? { title: 'Turnover on Downs Regensburg Phoenix', detail: null }
        : { title: `Turnover on Downs ${opponentName}`, detail: null };

    case EVENT_TYPE.SAFETY:
    case EVENT_TYPE.SAFETY_1PT: {
      const label = event.type === EVENT_TYPE.SAFETY ? 'Safety' : '1-Punkt-Safety';
      return event.team === TEAM.PHOENIX
        ? { title: `${label} Regensburg Phoenix`, detail: playerLabel(event.playerId, getPlayer) }
        : { title: `${label} ${opponentName}`, detail: null };
    }

    case EVENT_TYPE.HALFTIME:
      return {
        title: 'Halbzeit',
        detail: `Regensburg Phoenix ${runningScore.phoenix}:${runningScore.opponent} ${opponentName}`,
      };
    case EVENT_TYPE.SECOND_HALF_START:
      return {
        title: "Weiter geht's",
        detail: `Regensburg Phoenix ${runningScore.phoenix}:${runningScore.opponent} ${opponentName}`,
      };
    case EVENT_TYPE.TWO_MIN_WARNING:
      return {
        title: '2-Minuten-Warnung',
        detail: `Regensburg Phoenix ${runningScore.phoenix}:${runningScore.opponent} ${opponentName}`,
      };
    case EVENT_TYPE.GAME_END:
      return {
        title: 'Spielende',
        detail: `Regensburg Phoenix ${runningScore.phoenix}:${runningScore.opponent} ${opponentName}`,
      };

    default:
      // Defensiver Fallback für unbekannte Typen (sollte praktisch nie eintreten).
      return { title: event.type, detail: null };
  }
}

/**
 * Baut die Ticker-Einträge für ein komplettes Spiel (chronologisch, wie von
 * `listEventsByGame` geliefert). Der laufende Spielstand wird dabei Event für
 * Event mitgeführt (dieselbe Summierlogik wie `scoring.ts#calculateScore`,
 * hier bewusst inline statt importiert, um pro Eintrag den Zwischenstand statt
 * nur des Endstands zu erhalten).
 */
export function buildTickerEntries(
  events: GameEvent[],
  opponentName: string,
  getPlayer: PlayerLookup,
): TickerEntry[] {
  let phoenix = 0;
  let opponent = 0;
  const entries: TickerEntry[] = [];

  for (const event of events) {
    if (event.team === TEAM.PHOENIX) {
      phoenix += event.points;
    } else if (event.team === TEAM.OPPONENT) {
      opponent += event.points;
    }
    const { title, detail } = describeEvent(event, opponentName, getPlayer, { phoenix, opponent });
    entries.push({ event, title, detail });
  }

  return entries;
}

/**
 * "Letzte Events" (PRD §36): die letzten `limit` Einträge, neueste zuerst.
 * Leitet sich bewusst aus denselben `TickerEntry`-Objekten ab wie der
 * vollständige Liveticker (§39) – keine zweite Datenquelle/Formatierung.
 */
export function recentTickerEntries(entries: TickerEntry[], limit: number): TickerEntry[] {
  return entries.slice(-limit).reverse();
}
