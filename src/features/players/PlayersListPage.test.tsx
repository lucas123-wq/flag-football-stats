import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../data/db';
import { createPlayer } from '../../data/players';
import { PlayersListPage } from './PlayersListPage';

beforeEach(async () => {
  await db.players.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PlayersListPage />
    </MemoryRouter>,
  );
}

describe('PlayersListPage', () => {
  it('zeigt Trikotnummer, Name und Status je Spieler an', async () => {
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderPage();

    const row = (await screen.findByText('Max Mustermann')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('12')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Aktiv')).toBeInTheDocument();
  });

  it('trennt aktive und inaktive Spieler in eigenen Abschnitten', async () => {
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    renderPage();

    const activeSection = (await screen.findByText('Aktive Spieler')).closest('section');
    const inactiveSection = screen.getByText('Inaktive Spieler').closest('section');

    expect(within(activeSection as HTMLElement).getByText('Max Mustermann')).toBeInTheDocument();
    expect(
      within(activeSection as HTMLElement).queryByText('Alter Spieler'),
    ).not.toBeInTheDocument();

    expect(within(inactiveSection as HTMLElement).getByText('Alter Spieler')).toBeInTheDocument();
    expect(within(inactiveSection as HTMLElement).getByText('Inaktiv')).toBeInTheDocument();
  });

  it('zeigt einen Hinweistext, wenn keine aktiven Spieler vorhanden sind', async () => {
    renderPage();

    expect(await screen.findByText('Noch keine aktiven Spieler.')).toBeInTheDocument();
  });

  it('deaktiviert einen aktiven Spieler per Klick', async () => {
    const user = userEvent.setup();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderPage();

    const activeRow = (await screen.findByText('Max Mustermann')).closest('li') as HTMLElement;
    await user.click(within(activeRow).getByRole('button', { name: 'Deaktivieren' }));

    // Der Spieler wechselt in den Abschnitt "Inaktive Spieler" – dort erscheint
    // eine neue Listenzeile (die alte wird aus dem aktiven Abschnitt entfernt).
    const inactiveSection = screen.getByText('Inaktive Spieler').closest('section') as HTMLElement;
    const updatedRow = (await within(inactiveSection).findByText('Max Mustermann')).closest(
      'li',
    ) as HTMLElement;
    expect(within(updatedRow).getByText('Inaktiv')).toBeInTheDocument();
    expect(within(updatedRow).getByRole('button', { name: 'Aktivieren' })).toBeInTheDocument();
  });

  it('aktiviert einen inaktiven Spieler per Klick', async () => {
    const user = userEvent.setup();
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    renderPage();

    const inactiveRow = (await screen.findByText('Alter Spieler')).closest('li') as HTMLElement;
    await user.click(within(inactiveRow).getByRole('button', { name: 'Aktivieren' }));

    const activeSection = screen.getByText('Aktive Spieler').closest('section') as HTMLElement;
    const updatedRow = (await within(activeSection).findByText('Alter Spieler')).closest(
      'li',
    ) as HTMLElement;
    expect(within(updatedRow).getByText('Aktiv')).toBeInTheDocument();
  });
});
