import { describe, expect, it } from 'vitest';
import { assertValidPlayerInput, validatePlayerInput } from './playerValidation';
import type { Player } from './types';

function player(overrides: Partial<Player>): Player {
  return {
    id: 'existing-1',
    firstName: 'Max',
    lastName: 'Mustermann',
    jerseyNumber: 12,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('validatePlayerInput', () => {
  it('ist gültig für vollständige, korrekte Eingaben', () => {
    const errors = validatePlayerInput(
      { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7, active: true },
      { existingPlayers: [] },
    );
    expect(errors).toEqual({});
  });

  it('meldet fehlenden Vornamen', () => {
    const errors = validatePlayerInput(
      { firstName: '  ', lastName: 'Beispiel', jerseyNumber: 7, active: true },
      { existingPlayers: [] },
    );
    expect(errors.firstName).toMatch(/erforderlich/);
  });

  it('meldet fehlenden Nachnamen', () => {
    const errors = validatePlayerInput(
      { firstName: 'Peter', lastName: '', jerseyNumber: 7, active: true },
      { existingPlayers: [] },
    );
    expect(errors.lastName).toMatch(/erforderlich/);
  });

  it.each([-1, 100, 1.5, Number.NaN])('lehnt eine ungültige Trikotnummer %s ab', (jerseyNumber) => {
    const errors = validatePlayerInput(
      { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber, active: true },
      { existingPlayers: [] },
    );
    expect(errors.jerseyNumber).toBeDefined();
  });

  it.each([0, 7, 99])('akzeptiert gültige Trikotnummer %s', (jerseyNumber) => {
    const errors = validatePlayerInput(
      { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber, active: true },
      { existingPlayers: [] },
    );
    expect(errors.jerseyNumber).toBeUndefined();
  });

  it('lehnt eine unter aktiven Spielern doppelte Trikotnummer ab', () => {
    const errors = validatePlayerInput(
      { firstName: 'Neu', lastName: 'Spieler', jerseyNumber: 12, active: true },
      { existingPlayers: [player({ id: 'p1', jerseyNumber: 12, active: true })] },
    );
    expect(errors.jerseyNumber).toMatch(/bereits von einem aktiven Spieler/);
  });

  it('erlaubt dieselbe Trikotnummer, wenn der bestehende Spieler inaktiv ist', () => {
    const errors = validatePlayerInput(
      { firstName: 'Neu', lastName: 'Spieler', jerseyNumber: 15, active: true },
      { existingPlayers: [player({ id: 'p1', jerseyNumber: 15, active: false })] },
    );
    expect(errors.jerseyNumber).toBeUndefined();
  });

  it('schließt den bearbeiteten Spieler selbst von der Duplikatsprüfung aus', () => {
    const existing = player({ id: 'p1', jerseyNumber: 12, active: true });
    const errors = validatePlayerInput(
      { firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12, active: true },
      { existingPlayers: [existing], excludePlayerId: 'p1' },
    );
    expect(errors.jerseyNumber).toBeUndefined();
  });

  it('prüft keine Duplikate, wenn der Kandidat selbst inaktiv ist', () => {
    const errors = validatePlayerInput(
      { firstName: 'Neu', lastName: 'Spieler', jerseyNumber: 12, active: false },
      { existingPlayers: [player({ id: 'p1', jerseyNumber: 12, active: true })] },
    );
    expect(errors.jerseyNumber).toBeUndefined();
  });
});

describe('assertValidPlayerInput', () => {
  it('wirft bei ungültigen Daten', () => {
    expect(() =>
      assertValidPlayerInput(
        { firstName: '', lastName: 'Beispiel', jerseyNumber: 7, active: true },
        { existingPlayers: [] },
      ),
    ).toThrow(/Vorname/);
  });

  it('wirft nicht bei gültigen Daten', () => {
    expect(() =>
      assertValidPlayerInput(
        { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7, active: true },
        { existingPlayers: [] },
      ),
    ).not.toThrow();
  });
});
