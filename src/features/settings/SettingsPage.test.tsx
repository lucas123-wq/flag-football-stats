import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../data/db';
import { createEvent } from '../../data/events';
import { createGame } from '../../data/games';
import { createPlayer } from '../../data/players';
import { BACKUP_SCHEMA_VERSION, buildBackup } from '../../domain/backup';
import type { BackupFile } from '../../domain/backup';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from '../../domain/types';
import type { Game, GameEvent, Player } from '../../domain/types';
import { SettingsPage } from './SettingsPage';
import App from '../../App';

const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
const revokeObjectURLMock = vi.fn();

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  URL.createObjectURL = createObjectURLMock;
  URL.revokeObjectURL = revokeObjectURLMock;
});

function backupFile(backup: BackupFile, filename = 'backup.json'): File {
  return new File([JSON.stringify(backup)], filename, { type: 'application/json' });
}

async function selectFile(file: File) {
  const input = screen.getByLabelText('Backup-Datei auswählen');
  fireEvent.change(input, { target: { files: [file] } });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('SettingsPage – PRD §45', () => {
  it('rendert die Überschrift und die Bereiche gemäß §45', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument();
    expect(screen.getByText('Daten')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Daten exportieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Daten importieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alle Daten löschen' })).toBeInTheDocument();
    expect(screen.getByText(/App-Version/)).toBeInTheDocument();
  });

  it('zeigt die App-Version aus package.json', async () => {
    renderPage();
    expect(await screen.findByText(`App-Version ${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it('löscht bei Abbrechen der Sicherheitsabfrage keine Daten', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Alle Daten löschen' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Alle Daten löschen?\n\nDabei werden alle Spieler, Spiele und Events dauerhaft vom Gerät gelöscht.',
    );
    expect(await db.players.count()).toBe(1);
    expect(await db.games.count()).toBe(1);
  });

  it('löscht nach Bestätigung Spieler, Spiele und Events vollständig und navigiert sinnvoll weiter', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });

    renderAt('/einstellungen');
    await user.click(await screen.findByRole('button', { name: 'Alle Daten löschen' }));

    // Navigation nach der Löschung: zurück zur Spiele-Startseite (PRD §10),
    // die jetzt leer ist.
    expect(await screen.findByRole('heading', { name: 'Spiele' })).toBeInTheDocument();
    expect(await screen.findByText('Noch keine Spiele vorhanden.')).toBeInTheDocument();

    expect(await db.players.count()).toBe(0);
    expect(await db.games.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });
});

describe('SettingsPage – Export (PRD §5)', () => {
  it('löst beim Klick auf "Daten exportieren" einen Datei-Download mit sprechendem Dateinamen aus', async () => {
    const user = userEvent.setup();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Daten exportieren' }));

    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalledTimes(1));
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it('exportiert den vollständigen aktuellen Datenbestand inkl. IDs und Backup-Version', async () => {
    const user = userEvent.setup();
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Daten exportieren' }));
    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalledTimes(1));

    const blob = createObjectURLMock.mock.calls[0]?.[0] as Blob;
    const backup = JSON.parse(await blob.text()) as BackupFile;
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.players).toEqual([player]);
    expect(backup.games).toEqual([game]);
    expect(backup.events).toEqual([event]);
  });

  it('funktioniert auch mit leerer Datenbank', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Daten exportieren' }));

    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalledTimes(1));
    const blob = createObjectURLMock.mock.calls[0]?.[0] as Blob;
    const backup = JSON.parse(await blob.text()) as BackupFile;
    expect(backup.players).toEqual([]);
    expect(backup.games).toEqual([]);
    expect(backup.events).toEqual([]);
  });
});

describe('SettingsPage – Import: gültiges Backup (PRD §5)', () => {
  it('zeigt nach Auswahl einer gültigen Backup-Datei eine Vorschau mit den korrekten Anzahlen', async () => {
    const player = { ...makeBackupPlayer(), id: 'p1' };
    const game = makeBackupGame();
    const backup = buildBackup(
      [player],
      [game],
      [makeBackupEvent({ playerId: player.id, gameId: game.id })],
    );

    renderPage();
    await selectFile(backupFile(backup));

    expect(await screen.findByText('Backup gefunden')).toBeInTheDocument();
    expect(screen.getByText('Spieler')).toBeInTheDocument();
    const rows = screen.getAllByRole('definition');
    expect(rows.map((row) => row.textContent)).toEqual(['1', '1', '1', expect.any(String)]);
  });

  it('ändert bei Abbrechen der Vorschau nichts an der Datenbank', async () => {
    const user = userEvent.setup();
    const existingPlayer = await createPlayer({
      firstName: 'Alt',
      lastName: 'Spieler',
      jerseyNumber: 5,
    });
    const backup = buildBackup([makeBackupPlayer()], [], []);

    renderPage();
    await selectFile(backupFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByText('Backup gefunden')).not.toBeInTheDocument();
    const players = await db.players.toArray();
    expect(players).toEqual([existingPlayer]);
  });

  it('stellt nach Bestätigung Spieler, Spiele und Events inkl. IDs und Beziehungen wieder her und ersetzt bestehende Daten (kein Merge)', async () => {
    const user = userEvent.setup();
    await createPlayer({ firstName: 'Alt', lastName: 'Spieler', jerseyNumber: 99 });
    const oldGame = await createGame({ opponent: 'Alter Gegner', date: '2020-01-01' });
    await createEvent({
      gameId: oldGame.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });

    const qb = { ...makeBackupPlayer(), id: 'qb-1', jerseyNumber: 7 };
    const receiver = { ...makeBackupPlayer(), id: 'receiver-1', jerseyNumber: 12 };
    const game = makeBackupGame();
    const passingEvent = makeBackupEvent({
      id: 'evt-1',
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      playerId: null,
      qbId: qb.id,
      receiverId: receiver.id,
    });
    const backup = buildBackup([qb, receiver], [game], [passingEvent]);

    renderPage();
    await selectFile(backupFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Jetzt importieren' }));

    expect(
      await screen.findByText(/Backup erfolgreich importiert: 2 Spieler, 1 Spiele, 1 Events/),
    ).toBeInTheDocument();

    const players = await db.players.toArray();
    const games = await db.games.toArray();
    const events = await db.events.toArray();
    expect(players.map((p) => p.id).sort()).toEqual(['qb-1', 'receiver-1']);
    expect(games.map((g) => g.id)).toEqual([game.id]);
    expect(events).toHaveLength(1);
    expect(events[0]?.qbId).toBe('qb-1');
    expect(events[0]?.receiverId).toBe('receiver-1');
    // Alte Daten sind vollständig weg (Restore, kein Merge).
    expect(players.find((p) => p.jerseyNumber === 99)).toBeUndefined();
    expect(games.find((g) => g.opponent === 'Alter Gegner')).toBeUndefined();
  });

  it('aktualisiert andere Ansichten nach erfolgreichem Import (Single Source of Truth/Reaktivität)', async () => {
    const user = userEvent.setup();
    const game = makeBackupGame({ opponent: 'Berlin Adler' });
    const backup = buildBackup([], [game], []);

    renderAt('/einstellungen');
    await selectFile(backupFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Jetzt importieren' }));
    await screen.findByText(/Backup erfolgreich importiert/);

    await user.click(await screen.findByRole('link', { name: 'Spiele' }));
    expect(await screen.findByText('vs. Berlin Adler')).toBeInTheDocument();
  });
});

describe('SettingsPage – Import: Fehlerfälle (PRD §5)', () => {
  it.each([
    ['ungültiges JSON', 'das ist kein json'],
    ['falsche Backup-Version', JSON.stringify({ ...buildBackup([], [], []), schemaVersion: 99 })],
    [
      'fehlendes Pflichtfeld',
      (() => {
        const invalidPlayer = { ...makeBackupPlayer(), firstName: undefined } as unknown as Player;
        return JSON.stringify(buildBackup([invalidPlayer], [], []));
      })(),
    ],
    [
      'falscher Datentyp',
      (() => {
        const invalidPlayer = {
          ...makeBackupPlayer(),
          jerseyNumber: 'zwölf',
        } as unknown as Player;
        return JSON.stringify(buildBackup([invalidPlayer], [], []));
      })(),
    ],
    [
      'ungültiger Enum-Wert',
      (() => {
        const invalidGame = { ...makeBackupGame(), status: 'UNBEKANNT' } as unknown as Game;
        return JSON.stringify(buildBackup([], [invalidGame], []));
      })(),
    ],
    [
      'inkonsistente Beziehung',
      JSON.stringify({
        ...buildBackup([], [], [makeBackupEvent({ gameId: 'nicht-vorhanden' })]),
      }),
    ],
  ])('zeigt bei %s eine Fehlermeldung und ändert die Datenbank nicht', async (_label, rawJson) => {
    const existingPlayer = await createPlayer({
      firstName: 'Bestand',
      lastName: 'Spieler',
      jerseyNumber: 3,
    });

    renderPage();
    await selectFile(new File([rawJson], 'backup.json', { type: 'application/json' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Backup gefunden')).not.toBeInTheDocument();
    const players = await db.players.toArray();
    expect(players).toEqual([existingPlayer]);
  });
});

function makeBackupPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    firstName: 'Max',
    lastName: 'Mustermann',
    jerseyNumber: 12,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBackupGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    opponent: 'Munich Cowboys',
    date: '2026-09-12',
    status: GAME_STATUS.FINAL,
    createdAt: '2026-09-12T09:00:00.000Z',
    updatedAt: '2026-09-12T11:00:00.000Z',
    ...overrides,
  };
}

function makeBackupEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: 'event-1',
    gameId: 'game-1',
    sequence: 1,
    type: EVENT_TYPE.TOUCHDOWN_RUSHING,
    team: TEAM.PHOENIX,
    playerId: 'player-1',
    qbId: null,
    receiverId: null,
    successful: null,
    points: 6,
    half: HALF.FIRST,
    createdAt: '2026-09-12T09:05:00.000Z',
    updatedAt: '2026-09-12T09:05:00.000Z',
    ...overrides,
  };
}
