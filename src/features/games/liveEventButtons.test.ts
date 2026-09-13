import { describe, expect, it } from 'vitest';
import { OPPONENT_EVENT_BUTTONS, OWN_TEAM_EVENT_BUTTONS } from './liveEventButtons';

const EXPECTED_LABELS = [
  'Touchdown',
  '1-Punkt-Conversion',
  '2-Punkt-Conversion',
  'First Down',
  'Interception',
  'Pick 6',
  'Pick 2',
  'Sack',
  'Safety',
  '1-Punkt-Safety',
  'Turnover on Downs',
];

describe('liveEventButtons', () => {
  it('enthält alle vorgesehenen Buttons für die eigene Mannschaft', () => {
    expect(OWN_TEAM_EVENT_BUTTONS.map((b) => b.label)).toEqual(EXPECTED_LABELS);
  });

  it('spiegelt dieselben Eventtypen für den Gegner', () => {
    expect(OPPONENT_EVENT_BUTTONS.map((b) => b.label)).toEqual(EXPECTED_LABELS);
  });

  it('verwendet eindeutige Keys über beide Listen hinweg', () => {
    const allKeys = [...OWN_TEAM_EVENT_BUTTONS, ...OPPONENT_EVENT_BUTTONS].map((b) => b.key);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
