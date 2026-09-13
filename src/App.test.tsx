import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from './data/db';
import { createGame } from './data/games';
import { createPlayer } from './data/players';
import App from './App';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('leitet von "/" auf die Spieleübersicht weiter (PRD §10: Spiele ist die Startseite)', async () => {
    renderAt('/');

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
  });

  it('leitet unbekannte Routen ebenfalls auf die Spieleübersicht um', async () => {
    renderAt('/unbekannt');

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
  });
});

/**
 * GitHub Pages Project Page (https://<user>.github.io/flag-football-stats/):
 * `<BrowserRouter>` läuft in Produktion mit `basename="/flag-football-stats"`
 * (siehe `main.tsx`). `<App>` selbst enthält dafür keine Sonderlogik – alle
 * Routen/`<Link>`/`<Navigate>` sind relativ und werden von React Router
 * automatisch mit dem `basename` versehen. Diese Tests bilden exakt das
 * Produktions-Setup nach (`<MemoryRouter basename="/flag-football-stats">`
 * statt `<BrowserRouter>` – funktional identisch für Routing-Zwecke) und
 * belegen, dass Root-Weiterleitung, alle Hauptrouten und generierte Links
 * unter dem GitHub-Pages-Unterpfad korrekt funktionieren.
 */
describe('App – GitHub Pages Unterpfad (basename="/flag-football-stats")', () => {
  function renderWithBasename(path: string) {
    return render(
      <MemoryRouter basename="/flag-football-stats" initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
  }

  it('/flag-football-stats/ leitet auf /flag-football-stats/spiele weiter', async () => {
    renderWithBasename('/flag-football-stats/');

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
  });

  it.each([
    ['/flag-football-stats/spiele', /^spiele$/i],
    ['/flag-football-stats/spiele/neu', /^neues spiel$/i],
    ['/flag-football-stats/spieler', /^spieler$/i],
    ['/flag-football-stats/spieler/neu', /^spieler hinzufügen$/i],
    ['/flag-football-stats/einstellungen', /^einstellungen$/i],
  ])('%s rendert die korrekte Seite unter dem Unterpfad', async (path, expectedHeading) => {
    renderWithBasename(path);

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();
  });

  it('ein Spiel-Deep-Link (/flag-football-stats/spiele/:gameId) funktioniert unter dem Unterpfad', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    renderWithBasename(`/flag-football-stats/spiele/${game.id}`);

    expect(await screen.findByText('Munich Cowboys')).toBeInTheDocument();
  });

  it('von React Router generierte Links (NavLink/Link) enthalten den Unterpfad-Präfix', async () => {
    renderWithBasename('/flag-football-stats/spiele');

    expect(await screen.findByRole('link', { name: 'Spiele' })).toHaveAttribute(
      'href',
      '/flag-football-stats/spiele',
    );
    expect(screen.getByRole('link', { name: 'Spieler' })).toHaveAttribute(
      'href',
      '/flag-football-stats/spieler',
    );
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/flag-football-stats/einstellungen',
    );
  });

  it('unbekannte Routen unter dem Unterpfad leiten ebenfalls auf die Spieleübersicht um', async () => {
    renderWithBasename('/flag-football-stats/unbekannt');

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
  });
});

describe('App – Hauptnavigation (PRD §10)', () => {
  it('zeigt die Hauptnavigation mit allen drei Hauptbereichen auf jeder Seite', async () => {
    renderAt('/spiele');
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /^(Spiele|Spieler|Einstellungen)$/ });
    expect(links.map((link) => link.textContent)).toEqual(['Spiele', 'Spieler', 'Einstellungen']);
  });

  it('erreicht SPIELE über die Navigation und zeigt es als aktiv an', async () => {
    const user = userEvent.setup();
    renderAt('/einstellungen');

    await user.click(await screen.findByRole('link', { name: 'Spiele' }));

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spiele' })).toHaveAttribute('aria-current', 'page');
  });

  it('erreicht SPIELER über die Navigation und zeigt es als aktiv an', async () => {
    const user = userEvent.setup();
    renderAt('/spiele');

    await user.click(await screen.findByRole('link', { name: 'Spieler' }));

    expect(await screen.findByRole('heading', { name: /^spieler$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spieler' })).toHaveAttribute('aria-current', 'page');
  });

  it('erreicht EINSTELLUNGEN über die Navigation und zeigt es als aktiv an', async () => {
    const user = userEvent.setup();
    renderAt('/spiele');

    await user.click(await screen.findByRole('link', { name: 'Einstellungen' }));

    expect(await screen.findByRole('heading', { name: /^einstellungen$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('zeigt SPIELE auch auf Unterseiten (Spiel anlegen/öffnen) weiterhin als aktiv an (keine Regression)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    renderAt(`/spiele/${game.id}`);

    expect(await screen.findByText('Munich Cowboys')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spiele' })).toHaveAttribute('aria-current', 'page');
    // Die Navigation ersetzt nicht die bestehende Zurück-Navigation der Seite.
    expect(screen.getByRole('link', { name: '← Zurück zu Spielen' })).toBeInTheDocument();
  });

  it('zeigt SPIELER auch auf der Spieler-Bearbeiten-Unterseite weiterhin als aktiv an (keine Regression)', async () => {
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    renderAt(`/spieler/${player.id}/bearbeiten`);

    expect(await screen.findByDisplayValue('Max')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spieler' })).toHaveAttribute('aria-current', 'page');
  });

  it('bestehende Spiel-/Spieler-Routen funktionieren weiterhin unverändert', async () => {
    renderAt('/spiele/neu');
    expect(await screen.findByRole('heading', { name: 'Neues Spiel' })).toBeInTheDocument();

    renderAt('/spieler/neu');
    expect(await screen.findByRole('heading', { name: 'Spieler hinzufügen' })).toBeInTheDocument();
  });
});
