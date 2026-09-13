import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../data/db';
import { createGame } from '../../data/games';
import { GAME_STATUS } from '../../domain/types';
import App from '../../App';

beforeEach(async () => {
  await db.games.clear();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('NewGamePage', () => {
  it('legt ein neues Spiel mit Gegnernamen an und navigiert zur Spielseite', async () => {
    const user = userEvent.setup();
    renderAt('/spiele/neu');

    await user.type(screen.getByLabelText('Gegner'), 'Munich Cowboys');
    await user.click(screen.getByRole('button', { name: 'Spiel starten' }));

    // Landet auf der Detailseite des neu erstellten Spiels.
    expect(await screen.findByText('Munich Cowboys')).toBeInTheDocument();

    const stored = await db.games.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      opponent: 'Munich Cowboys',
      status: GAME_STATUS.LIVE_FIRST_HALF,
    });
    expect(stored[0]?.date).toBeTruthy();
  });

  it('zeigt einen Fehler bei fehlendem Gegnernamen und speichert nichts', async () => {
    const user = userEvent.setup();
    renderAt('/spiele/neu');

    await user.click(screen.getByRole('button', { name: 'Spiel starten' }));

    expect(await screen.findByText('Gegnername ist erforderlich.')).toBeInTheDocument();
    expect(await db.games.count()).toBe(0);
  });

  it('erscheint nach dem Erstellen in der Spieleliste', async () => {
    const user = userEvent.setup();
    renderAt('/spiele/neu');

    await user.type(screen.getByLabelText('Gegner'), 'Stuttgart Scorpions');
    await user.click(screen.getByRole('button', { name: 'Spiel starten' }));
    await screen.findByText('Stuttgart Scorpions');

    await user.click(await screen.findByRole('link', { name: '← Zurück zu Spielen' }));

    expect(await screen.findByText('vs. Stuttgart Scorpions')).toBeInTheDocument();
  });

  it('erlaubt bereits vorhandene Spiele (z. B. für einen anderen Gegner)', async () => {
    await createGame({ opponent: 'Existierendes Spiel', date: '2026-09-01' });

    const user = userEvent.setup();
    renderAt('/spiele/neu');
    await user.type(screen.getByLabelText('Gegner'), 'Neues Spiel');
    await user.click(screen.getByRole('button', { name: 'Spiel starten' }));

    expect(await db.games.count()).toBe(2);
  });
});
