import type { Game } from '../../domain/types';

/**
 * Sortiert Spiele mit dem neuesten zuerst (PRD §11: "VERGANGENE SPIELE" wird
 * chronologisch absteigend erwartet). Primär nach dem Spieldatum, bei
 * gleichem Datum nach Erstellzeitpunkt (stabile Reihenfolge bei mehreren
 * Spielen am selben Tag). `date` ist ein ISO-Datum (yyyy-mm-dd) und damit
 * lexikographisch chronologisch vergleichbar.
 */
export function sortGamesByRecency(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
