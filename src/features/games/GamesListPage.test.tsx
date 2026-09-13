import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../data/db';
import { createGame, setGameStatus } from '../../data/games';
import { GAME_STATUS } from '../../domain/types';
import { GamesListPage } from './GamesListPage';

beforeEach(async () => {
  await db.games.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <GamesListPage />
    </MemoryRouter>,
  );
}

describe('GamesListPage', () => {
  it('zeigt einen Hinweistext, wenn noch keine Spiele vorhanden sind', async () => {
    renderPage();
    expect(await screen.findByText('Noch keine Spiele vorhanden.')).toBeInTheDocument();
  });

  it('zeigt Gegner, Datum und Status je Spiel an', async () => {
    await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderPage();

    const row = (await screen.findByText('vs. Munich Cowboys')).closest('li') as HTMLElement;
    expect(within(row).getByText(/12\.09\.2026/)).toBeInTheDocument();
    expect(within(row).getByText(/Läuft/)).toBeInTheDocument();
    const openLink = within(row).getByRole('link', { name: 'Öffnen' });
    expect(openLink.getAttribute('href')).toMatch(/^\/spiele\/.+/);
  });

  it('zeigt "Beendet" für abgeschlossene Spiele', async () => {
    const game = await createGame({ opponent: 'Stuttgart Scorpions', date: '2026-09-20' });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderPage();

    const row = (await screen.findByText('vs. Stuttgart Scorpions')).closest('li') as HTMLElement;
    expect(within(row).getByText(/Beendet/)).toBeInTheDocument();
  });

  it('sortiert Spiele mit dem neuesten zuerst', async () => {
    await createGame({ opponent: 'Älteres Spiel', date: '2026-09-01' });
    await createGame({ opponent: 'Neueres Spiel', date: '2026-09-20' });

    renderPage();

    await screen.findByText('vs. Neueres Spiel');
    const items = screen.getAllByRole('listitem');
    const texts = items.map((item) => item.textContent);
    expect(texts[0]).toContain('Neueres Spiel');
    expect(texts[1]).toContain('Älteres Spiel');
  });

  it('bietet einen gut sichtbaren Button für ein neues Spiel', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: '+ Neues Spiel' })).toHaveAttribute(
      'href',
      '/spiele/neu',
    );
  });
});
