import { describe, expect, it } from 'vitest';
import { assertValidGameInput, validateGameInput } from './gameValidation';

describe('validateGameInput', () => {
  it('ist gültig für vollständige Eingaben', () => {
    expect(validateGameInput({ opponent: 'Munich Cowboys', date: '2026-09-12' })).toEqual({});
  });

  it('meldet einen fehlenden Gegnernamen', () => {
    const errors = validateGameInput({ opponent: '  ', date: '2026-09-12' });
    expect(errors.opponent).toMatch(/erforderlich/);
  });

  it('meldet ein fehlendes Datum', () => {
    const errors = validateGameInput({ opponent: 'Munich Cowboys', date: '' });
    expect(errors.date).toMatch(/erforderlich/);
  });
});

describe('assertValidGameInput', () => {
  it('wirft bei ungültigen Daten', () => {
    expect(() => assertValidGameInput({ opponent: '', date: '2026-09-12' })).toThrow(/Gegnername/);
  });

  it('wirft nicht bei gültigen Daten', () => {
    expect(() =>
      assertValidGameInput({ opponent: 'Munich Cowboys', date: '2026-09-12' }),
    ).not.toThrow();
  });
});
