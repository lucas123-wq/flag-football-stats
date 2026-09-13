import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventButtonGrid } from './EventButtonGrid';
import type { LiveEventButtonConfig } from './liveEventButtons';

const BUTTONS: LiveEventButtonConfig[] = [
  { key: 'touchdown', label: 'Touchdown' },
  { key: 'sack', label: 'Sack' },
];

describe('EventButtonGrid', () => {
  it('rendert alle übergebenen Buttons mit Titel', () => {
    render(
      <EventButtonGrid
        title="Eigene Mannschaft"
        buttons={BUTTONS}
        disabled={false}
        onButtonClick={() => {}}
      />,
    );

    expect(screen.getByText('Eigene Mannschaft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Touchdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sack' })).toBeInTheDocument();
  });

  it('ruft onButtonClick mit dem angeklickten Button auf', async () => {
    const user = userEvent.setup();
    const onButtonClick = vi.fn();
    render(
      <EventButtonGrid
        title="Eigene Mannschaft"
        buttons={BUTTONS}
        disabled={false}
        onButtonClick={onButtonClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Touchdown' }));

    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(onButtonClick).toHaveBeenCalledWith(BUTTONS[0]);
  });

  it('deaktiviert alle Buttons, wenn disabled gesetzt ist', async () => {
    const user = userEvent.setup();
    const onButtonClick = vi.fn();
    render(
      <EventButtonGrid
        title="Eigene Mannschaft"
        buttons={BUTTONS}
        disabled
        onButtonClick={onButtonClick}
      />,
    );

    const touchdownButton = screen.getByRole('button', { name: 'Touchdown' });
    expect(touchdownButton).toBeDisabled();

    await user.click(touchdownButton);
    expect(onButtonClick).not.toHaveBeenCalled();
  });
});
