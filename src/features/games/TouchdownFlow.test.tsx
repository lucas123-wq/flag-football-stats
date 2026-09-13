import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../data/db';
import { createPlayer } from '../../data/players';
import { createGame } from '../../data/games';
import { calculatePlayerStats } from '../../domain/stats';
import { EVENT_TYPE, GAME_STATUS, TEAM } from '../../domain/types';
import type { Game } from '../../domain/types';
import { TouchdownFlow } from './TouchdownFlow';
import * as eventsRepo from '../../data/events';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

async function setupGame(): Promise<Game> {
  return createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
}

describe('TouchdownFlow – Rushing TD', () => {
  it('öffnet die Art-Auswahl (Rushing/Passing) für das eigene Team', async () => {
    const game = await setupGame();
    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText('Art des Touchdowns')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rushing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passing' })).toBeInTheDocument();
  });

  it('zeigt bei Rushing nur aktive Spieler zur Auswahl', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));

    expect(await screen.findByRole('button', { name: '#12 Max Mustermann' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alter Spieler/ })).not.toBeInTheDocument();
  });

  it('zeigt nach Spielerauswahl die Bestätigungsseite und speichert vorher kein Event', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));

    expect(await screen.findByText('Touchdown Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('#12 Max Mustermann')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Abbrechen kein Event und ruft onCancel auf', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const onCancel = vi.fn();

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={onCancel} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    // Es gibt zwei "Abbrechen"-Buttons (Header + Bestätigungsseite) – hier
    // wird gezielt der auf der Bestätigungsseite geklickt (PRD §16/§7).
    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Event mit dem korrekten Spieler, erhöht den Score um 6 und erzeugt den korrekten WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    // Auf `onSaved` warten statt nur auf den DB-Zähler: Zwischen dem
    // Schreiben des Events und dem Aufruf von `onSaved` liegt noch ein
    // weiterer Await (`listEventsByGame`) – unter Last könnte der DB-Zähler
    // sonst schon vor `onSaved` aktuell sein (falsches Grün/Rot).
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: scorer.id,
      points: 6,
    });

    expect(calculatePlayerStats(events, scorer.id).rushingTouchdowns).toBe(1);
    expect(onSaved).toHaveBeenCalledWith(
      'Touchdown Regensburg Phoenix #12 Max Mustermann\nNeuer Spielstand: 6:0',
    );
  });
});

describe('TouchdownFlow – Passing TD', () => {
  it('führt durch QB- und Receiver-Auswahl und zeigt beide auf der Bestätigungsseite', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Passing' }));

    expect(await screen.findByText('Wer hat den Touchdown geworfen?')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '#7 Peter Beispiel' }));

    expect(await screen.findByText('Wer hat den Touchdown gefangen?')).toBeInTheDocument();
    // Der bereits gewählte QB darf nicht mehr als Receiver wählbar sein.
    expect(screen.queryByRole('button', { name: '#7 Peter Beispiel' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));

    expect(await screen.findByText('Touchdown Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('#7 Peter Beispiel → #12 Max Mustermann')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Passing-TD-Event: QB bekommt Passing TD +1, Receiver Receiving TD +1', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const qb = await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    const receiver = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Passing' }));
    await user.click(await screen.findByRole('button', { name: '#7 Peter Beispiel' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: qb.id,
      receiverId: receiver.id,
      playerId: null,
      points: 6,
    });

    expect(calculatePlayerStats(events, qb.id).passingTouchdowns).toBe(1);
    expect(calculatePlayerStats(events, receiver.id).receivingTouchdowns).toBe(1);
    expect(onSaved).toHaveBeenCalledWith(
      'Touchdown Regensburg Phoenix #7 Peter Beispiel -> #12 Max Mustermann\nNeuer Spielstand: 6:0',
    );
  });
});

describe('TouchdownFlow – Gegner-TD', () => {
  it('zeigt direkt die Bestätigungsseite ohne Spielerauswahl', async () => {
    const game = await setupGame();
    render(<TouchdownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText('Touchdown Munich Cowboys')).toBeInTheDocument();
    expect(screen.queryByText('Art des Touchdowns')).not.toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN TOUCHDOWN_OPPONENT-Event, lässt Spieler unberührt und erhöht den Gegner-Score', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const onSaved = vi.fn();

    render(<TouchdownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      playerId: null,
      qbId: null,
      receiverId: null,
      points: 6,
    });

    // Eigener Spielerbestand bleibt unverändert.
    expect(await db.players.count()).toBe(1);
    expect(onSaved).toHaveBeenCalledWith('Touchdown Munich Cowboys\nNeuer Spielstand: 0:6');
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const game = await setupGame();
    const onSaved = vi.fn();

    render(<TouchdownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – im Unterschied zu
    // `userEvent.click`, das den ersten Klick inkl. aller internen Awaits
    // abschließt, bevor der zweite ausgelöst wird. Prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `TouchdownFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('TouchdownFlow – Fehlerbehandlung', () => {
  it('verhindert das Speichern, wenn der ausgewählte Spieler nicht mehr existiert', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(<TouchdownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));

    // Spieler wird zwischen Auswahl und Bestätigung entfernt (Simulation).
    await db.players.delete(scorer.id);

    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText(/existiert nicht mehr/)).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('zeigt eine verständliche Fehlermeldung, wenn das Speichern fehlschlägt, und erlaubt einen erneuten Versuch', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    const createEventSpy = vi
      .spyOn(eventsRepo, 'createEvent')
      .mockRejectedValueOnce(new Error('Simulierter Speicherfehler'));

    render(<TouchdownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('Simulierter Speicherfehler')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.events.count()).toBe(0);

    // Erneuter Versuch funktioniert (Spy erlaubt danach den echten Aufruf).
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);

    createEventSpy.mockRestore();
  });
});

describe('TouchdownFlow – Halbzeit', () => {
  it('verwendet die erste Halbzeit, solange der Spielstatus LIVE_FIRST_HALF ist', async () => {
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);

    const user = userEvent.setup();
    render(<TouchdownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(async () => expect(await db.events.count()).toBe(1));
    const [savedEvent] = await db.events.toArray();
    expect(savedEvent?.half).toBe(1);
  });
});
