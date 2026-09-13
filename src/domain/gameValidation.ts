export interface GameInputCandidate {
  opponent: string;
  date: string;
}

export type GameValidationErrors = Partial<Record<'opponent' | 'date', string>>;

/** Prüft Formulardaten für ein Spiel (PRD §12: Gegner + Datum sind Pflichtangaben). */
export function validateGameInput(input: GameInputCandidate): GameValidationErrors {
  const errors: GameValidationErrors = {};

  if (!input.opponent.trim()) {
    errors.opponent = 'Gegnername ist erforderlich.';
  }
  if (!input.date.trim()) {
    errors.date = 'Datum ist erforderlich.';
  }

  return errors;
}

/** Wie {@link validateGameInput}, wirft aber bei Fehlern einen `Error`. */
export function assertValidGameInput(input: GameInputCandidate): void {
  const errors = validateGameInput(input);
  const firstError = errors.opponent ?? errors.date;
  if (firstError) {
    throw new Error(firstError);
  }
}
