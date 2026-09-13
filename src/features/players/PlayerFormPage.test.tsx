import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../data/db';
import { createPlayer } from '../../data/players';
import App from '../../App';

beforeEach(async () => {
  await db.players.clear();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { firstName?: string; lastName?: string; jerseyNumber?: string },
) {
  // Die Seite zeigt zunächst "Lade…", bis die (asynchrone) Live-Query für den
  // Bearbeitungskontext aufgelöst ist – daher hier auf das erste Feld warten.
  if (values.firstName !== undefined) {
    await user.type(await screen.findByLabelText('Vorname'), values.firstName);
  }
  if (values.lastName !== undefined) {
    await user.type(screen.getByLabelText('Nachname'), values.lastName);
  }
  if (values.jerseyNumber !== undefined) {
    await user.type(screen.getByLabelText('Trikotnummer'), values.jerseyNumber);
  }
}

describe('PlayerFormPage – Spieler hinzufügen', () => {
  it('legt einen neuen Spieler mit gültigen Daten an und kehrt zur Liste zurück', async () => {
    const user = userEvent.setup();
    renderAt('/spieler/neu');

    await fillForm(user, { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: '7' });
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('heading', { name: /^spieler$/i })).toBeInTheDocument();
    expect(await screen.findByText('Peter Beispiel')).toBeInTheDocument();

    const stored = await db.players.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
  });

  it('zeigt Fehlermeldungen bei fehlenden Pflichtfeldern und speichert nichts', async () => {
    const user = userEvent.setup();
    renderAt('/spieler/neu');

    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Vorname ist erforderlich.')).toBeInTheDocument();
    expect(screen.getByText('Nachname ist erforderlich.')).toBeInTheDocument();
    expect(await db.players.count()).toBe(0);
  });

  it('zeigt eine Fehlermeldung bei ungültiger Trikotnummer', async () => {
    const user = userEvent.setup();
    renderAt('/spieler/neu');

    await fillForm(user, { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: '150' });
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(
      await screen.findByText(/Trikotnummer muss eine ganze Zahl zwischen 0 und 99 sein/),
    ).toBeInTheDocument();
    expect(await db.players.count()).toBe(0);
  });

  it('zeigt eine Fehlermeldung bei einer bereits vergebenen Trikotnummer', async () => {
    const user = userEvent.setup();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt('/spieler/neu');
    await fillForm(user, { firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: '12' });
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(
      await screen.findByText(/bereits von einem aktiven Spieler verwendet/),
    ).toBeInTheDocument();
    expect(await db.players.count()).toBe(1);
  });
});

describe('PlayerFormPage – Spieler bearbeiten', () => {
  it('lädt die bestehenden Daten vorbefüllt', async () => {
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    renderAt(`/spieler/${player.id}/bearbeiten`);

    expect(await screen.findByLabelText('Vorname')).toHaveValue('Max');
    expect(screen.getByLabelText('Nachname')).toHaveValue('Mustermann');
    expect(screen.getByLabelText('Trikotnummer')).toHaveValue(12);
    expect(screen.getByLabelText('Aktiv')).toBeChecked();
  });

  it('speichert Änderungen am Spieler', async () => {
    const user = userEvent.setup();
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    renderAt(`/spieler/${player.id}/bearbeiten`);

    const lastNameInput = await screen.findByLabelText('Nachname');
    await user.clear(lastNameInput);
    await user.type(lastNameInput, 'Neumann');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Max Neumann')).toBeInTheDocument();
    const updated = await db.players.get(player.id);
    expect(updated?.lastName).toBe('Neumann');
  });

  it('zeigt einen Hinweis, wenn der Spieler nicht existiert', async () => {
    renderAt('/spieler/unbekannte-id/bearbeiten');

    expect(await screen.findByText('Spieler wurde nicht gefunden.')).toBeInTheDocument();
  });
});
