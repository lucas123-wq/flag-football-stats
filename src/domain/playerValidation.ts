import type { Player } from './types';

/**
 * Gültiger Trikotnummernbereich. In der PRD nicht spezifiziert – 0–99 ist der
 * im Flag-Football/American-Football übliche Bereich und wird hier als
 * sinnvolle, dokumentierte technische Entscheidung verwendet.
 */
export const JERSEY_NUMBER_MIN = 0;
export const JERSEY_NUMBER_MAX = 99;

export interface PlayerInputCandidate {
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  active: boolean;
}

export interface PlayerValidationContext {
  /** Bereits gespeicherte Spieler, gegen die auf doppelte Trikotnummern geprüft wird. */
  existingPlayers: Player[];
  /** Beim Bearbeiten: ID des Spielers, der von der Duplikatsprüfung ausgenommen wird. */
  excludePlayerId?: string;
}

export type PlayerValidationErrors = Partial<
  Record<'firstName' | 'lastName' | 'jerseyNumber', string>
>;

/**
 * Prüft Formulardaten für einen Spieler und liefert feldbezogene
 * Fehlermeldungen (leeres Objekt = gültig).
 *
 * Trikotnummern müssen laut technischem Plan nur unter AKTIVEN Spielern
 * eindeutig sein (die PRD nennt keine explizite Regel dazu) – deaktivierte
 * Spieler "geben" ihre Nummer damit für neue/andere aktive Spieler frei.
 * Ein inaktiver Kandidat wird deshalb nie auf Duplikate geprüft.
 */
export function validatePlayerInput(
  input: PlayerInputCandidate,
  context: PlayerValidationContext,
): PlayerValidationErrors {
  const errors: PlayerValidationErrors = {};

  if (!input.firstName.trim()) {
    errors.firstName = 'Vorname ist erforderlich.';
  }
  if (!input.lastName.trim()) {
    errors.lastName = 'Nachname ist erforderlich.';
  }

  if (
    !Number.isInteger(input.jerseyNumber) ||
    input.jerseyNumber < JERSEY_NUMBER_MIN ||
    input.jerseyNumber > JERSEY_NUMBER_MAX
  ) {
    errors.jerseyNumber = `Trikotnummer muss eine ganze Zahl zwischen ${JERSEY_NUMBER_MIN} und ${JERSEY_NUMBER_MAX} sein.`;
  } else if (input.active) {
    const duplicate = context.existingPlayers.some(
      (player) =>
        player.id !== context.excludePlayerId &&
        player.active &&
        player.jerseyNumber === input.jerseyNumber,
    );
    if (duplicate) {
      errors.jerseyNumber = `Trikotnummer #${input.jerseyNumber} wird bereits von einem aktiven Spieler verwendet.`;
    }
  }

  return errors;
}

/** Wie {@link validatePlayerInput}, wirft aber bei Fehlern einen `Error`. */
export function assertValidPlayerInput(
  input: PlayerInputCandidate,
  context: PlayerValidationContext,
): void {
  const errors = validatePlayerInput(input, context);
  const firstError = errors.firstName ?? errors.lastName ?? errors.jerseyNumber;
  if (firstError) {
    throw new Error(firstError);
  }
}
