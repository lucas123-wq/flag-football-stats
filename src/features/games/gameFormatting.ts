import { GAME_STATUS } from '../../domain/types';
import type { GameStatus } from '../../domain/types';

/**
 * Vereinfachte Statusanzeige für die Spielverwaltung. Die Halbzeit-
 * Zwischenzustände (`HALFTIME`, `LIVE_SECOND_HALF`) werden hier bewusst noch
 * nicht UI-seitig unterschieden – das gehört zur Halbzeitlogik/zum
 * Live-Screen, die/der in diesem Schritt explizit noch nicht implementiert
 * wird. Ein "geplant"-Status existiert im Datenmodell nicht: Spiele werden
 * laut PRD §12 immer sofort im Zustand `LIVE_FIRST_HALF` angelegt.
 */
export function getGameStatusLabel(status: GameStatus): string {
  switch (status) {
    case GAME_STATUS.LIVE_FIRST_HALF:
    case GAME_STATUS.HALFTIME:
    case GAME_STATUS.LIVE_SECOND_HALF:
      return 'Läuft';
    case GAME_STATUS.FINAL:
      return 'Beendet';
  }
}

/**
 * Detaillierte Statusanzeige für den Live-Spielbildschirm – im Unterschied zu
 * `getGameStatusLabel` (Spieleliste), die die Halbzeit-Zwischenzustände
 * bewusst zu "Läuft" zusammenfasst, unterscheidet der Live-Screen die
 * einzelnen Phasen (PRD §13).
 */
export function getLiveGameStatusLabel(status: GameStatus): string {
  switch (status) {
    case GAME_STATUS.LIVE_FIRST_HALF:
      return '1. Halbzeit';
    case GAME_STATUS.HALFTIME:
      return 'Halbzeit';
    case GAME_STATUS.LIVE_SECOND_HALF:
      return '2. Halbzeit';
    case GAME_STATUS.FINAL:
      return 'Beendet';
  }
}

/** Formatiert ein ISO-Datum (yyyy-mm-dd) als deutsches Datum (TT.MM.JJJJ). */
export function formatGameDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
