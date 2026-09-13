import { EVENT_TYPE, TEAM } from './types';
import type { GameEvent } from './types';

/**
 * Spielerstatistiken für ein Spiel. Enthält alle bisher implementierten
 * Event-Typen (Touchdown, Conversion, First Down, Interception, Pick 6,
 * Pick 2, Sack, Safety, 1-Punkt-Safety – PRD §34). Keine generische "für
 * alle Eventtypen"-Struktur.
 */
export interface PlayerGameStats {
  rushingTouchdowns: number;
  passingTouchdowns: number;
  receivingTouchdowns: number;
  onePointConversions: number;
  twoPointConversions: number;
  firstDowns: number;
  interceptions: number;
  pickSixes: number;
  pickTwos: number;
  sacks: number;
  safeties: number;
  onePointSafeties: number;
}

/**
 * Berechnet die Statistiken eines Spielers ausschließlich aus den
 * gespeicherten Events (PRD §35, Single Source of Truth) – es werden keine
 * redundanten Statistikwerte am `Player`-Datensatz gepflegt.
 */
export function calculatePlayerStats(events: GameEvent[], playerId: string): PlayerGameStats {
  const stats: PlayerGameStats = {
    rushingTouchdowns: 0,
    passingTouchdowns: 0,
    receivingTouchdowns: 0,
    onePointConversions: 0,
    twoPointConversions: 0,
    firstDowns: 0,
    interceptions: 0,
    pickSixes: 0,
    pickTwos: 0,
    sacks: 0,
    safeties: 0,
    onePointSafeties: 0,
  };

  for (const event of events) {
    if (event.type === EVENT_TYPE.TOUCHDOWN_RUSHING && event.playerId === playerId) {
      stats.rushingTouchdowns += 1;
    }
    if (event.type === EVENT_TYPE.TOUCHDOWN_PASSING) {
      if (event.qbId === playerId) {
        stats.passingTouchdowns += 1;
      }
      if (event.receiverId === playerId) {
        stats.receivingTouchdowns += 1;
      }
    }
    // Eine fehlgeschlagene Conversion hat laut PRD §9 keine Spielerreferenz
    // und zählt daher hier ohnehin nie (playerId ist dann null).
    if (
      event.type === EVENT_TYPE.CONVERSION_1PT &&
      event.team === TEAM.PHOENIX &&
      event.successful &&
      event.playerId === playerId
    ) {
      stats.onePointConversions += 1;
    }
    if (
      event.type === EVENT_TYPE.CONVERSION_2PT &&
      event.team === TEAM.PHOENIX &&
      event.successful &&
      event.playerId === playerId
    ) {
      stats.twoPointConversions += 1;
    }
    if (
      event.type === EVENT_TYPE.FIRST_DOWN &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.firstDowns += 1;
    }
    // Pick 6/Pick 2 sind eigenständige Eventtypen (PRD §22/§23) und zählen
    // hier bewusst NICHT zusätzlich als Interception.
    if (
      event.type === EVENT_TYPE.INTERCEPTION &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.interceptions += 1;
    }
    if (
      event.type === EVENT_TYPE.PICK_6 &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.pickSixes += 1;
    }
    if (
      event.type === EVENT_TYPE.PICK_2 &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.pickTwos += 1;
    }
    if (
      event.type === EVENT_TYPE.SACK &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.sacks += 1;
    }
    if (
      event.type === EVENT_TYPE.SAFETY &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.safeties += 1;
    }
    if (
      event.type === EVENT_TYPE.SAFETY_1PT &&
      event.team === TEAM.PHOENIX &&
      event.playerId === playerId
    ) {
      stats.onePointSafeties += 1;
    }
  }

  return stats;
}

/**
 * Ermittelt alle Spieler-IDs, die in mindestens einem Event dieses Spiels als
 * `playerId`, `qbId` oder `receiverId` auftauchen (PRD §40: Statistiken pro
 * teilnehmendem Spieler eines Spiels). Reine Ableitung aus den Events, keine
 * Sortierung/Filterung nach aktiv/inaktiv – das übernimmt die UI mithilfe der
 * vollständigen Spielerliste (`data/players.ts#listPlayers`), damit auch
 * inzwischen deaktivierte Spieler korrekt weiter angezeigt werden (PRD §9.2).
 */
export function getParticipantPlayerIds(events: GameEvent[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.playerId) {
      ids.add(event.playerId);
    }
    if (event.qbId) {
      ids.add(event.qbId);
    }
    if (event.receiverId) {
      ids.add(event.receiverId);
    }
  }
  return [...ids];
}
