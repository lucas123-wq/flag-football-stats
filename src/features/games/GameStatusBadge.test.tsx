import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameStatusBadge } from './GameStatusBadge';
import { GAME_STATUS } from '../../domain/types';

describe('GameStatusBadge', () => {
  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, '1. Halbzeit'],
    [GAME_STATUS.HALFTIME, 'Halbzeit'],
    [GAME_STATUS.LIVE_SECOND_HALF, '2. Halbzeit'],
    [GAME_STATUS.FINAL, 'Beendet'],
  ])('zeigt für %s "%s" an', (status, expected) => {
    render(<GameStatusBadge status={status} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
