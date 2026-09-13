import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Scoreboard } from './Scoreboard';

describe('Scoreboard', () => {
  it('zeigt Teamnamen und Spielstand an', () => {
    render(<Scoreboard opponent="Munich Cowboys" phoenixScore={0} opponentScore={0} />);

    expect(screen.getByText('Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('Munich Cowboys')).toBeInTheDocument();
    expect(screen.getByText('0 : 0')).toBeInTheDocument();
  });

  it('zeigt einen übergebenen Spielstand an', () => {
    render(<Scoreboard opponent="Munich Cowboys" phoenixScore={12} opponentScore={6} />);
    expect(screen.getByText('12 : 6')).toBeInTheDocument();
  });
});
