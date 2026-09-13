import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../data/db';
import { createPlayer } from '../../data/players';
import { createGame } from '../../data/games';
import { createEvent } from '../../data/events';
import { calculatePlayerStats } from '../../domain/stats';
import { calculateScore } from '../../domain/scoring';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from '../../domain/types';
import type { Game } from '../../domain/types';
import { FirstDownFlow } from './FirstDownFlow';
import * as eventsRepo from '../../data/events';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

async function setupGame(): Promise<Game> {
  return createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
}

async function seedOwnTouchdown(gameId: string) {
  await createEvent({
    gameId,
    type: EVENT_TYPE.TOUCHDOWN_RUSHING,
    team: TEAM.PHOENIX,
    playerId: 'seed-player',
    points: 6,
    half: HALF.FIRST,
  });
}

describe('FirstDownFlow – eigener First Down', () => {
  it('zeigt nur aktive Spieler zur Auswahl, keine Rushing/Passing-Auswahl', async () => {
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    render(<FirstDownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);

    expect(
      await screen.findByText('Welcher Spieler hat den First Down erzielt?'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '#12 Max Mustermann' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alter Spieler/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rushing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Passing' })).not.toBeInTheDocument();
  });

  it('zeigt nach Spielerauswahl die Bestätigungsseite und speichert vorher kein Event', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    render(<FirstDownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));

    expect(await screen.findByText('First Down Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('#12 Max Mustermann')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Abbrechen kein Event', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const onCancel = vi.fn();

    render(<FirstDownFlow game={game} team={TEAM.PHOENIX} onCancel={onCancel} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Event mit korrektem Spieler, 0 Punkten, unverändertem Score, First-Down-Statistik +1 und korrektem WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await seedOwnTouchdown(game.id); // Score vorher 6:0
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(<FirstDownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const allEvents = await db.events.toArray();
    const firstDownEvents = allEvents.filter((e) => e.type === EVENT_TYPE.FIRST_DOWN);
    expect(firstDownEvents).toHaveLength(1);
    expect(firstDownEvents[0]).toMatchObject({
      gameId: game.id,
      team: TEAM.PHOENIX,
      playerId: scorer.id,
      points: 0,
      half: HALF.FIRST,
    });

    // Score bleibt unverändert (nur der gesäte TD zählt).
    expect(calculateScore(allEvents)).toEqual({ phoenix: 6, opponent: 0 });
    expect(calculatePlayerStats(allEvents, scorer.id).firstDowns).toBe(1);
    // Score ändert sich durch First Down nie -> keine Spielstand-Zeile in der Nachricht.
    expect(onSaved).toHaveBeenCalledWith('First Down Regensburg Phoenix #12 Max Mustermann');
  });
});

describe('FirstDownFlow – Gegner', () => {
  it('zeigt keine Spielerauswahl, sondern direkt die Bestätigungsseite', async () => {
    const game = await setupGame();
    render(<FirstDownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText('First Down Munich Cowboys')).toBeInTheDocument();
    expect(
      screen.queryByText('Welcher Spieler hat den First Down erzielt?'),
    ).not.toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN gegnerisches First-Down-Event ohne Spielerreferenz, unverändertem Score, ohne eigene Spielerstatistik und mit korrektem WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await seedOwnTouchdown(game.id); // Score vorher 6:0
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(<FirstDownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const allEvents = await db.events.toArray();
    const firstDownEvents = allEvents.filter((e) => e.type === EVENT_TYPE.FIRST_DOWN);
    expect(firstDownEvents).toHaveLength(1);
    expect(firstDownEvents[0]).toMatchObject({
      team: TEAM.OPPONENT,
      playerId: null,
      points: 0,
    });

    expect(calculateScore(allEvents)).toEqual({ phoenix: 6, opponent: 0 });
    expect(calculatePlayerStats(allEvents, player.id).firstDowns).toBe(0);
    expect(onSaved).toHaveBeenCalledWith('First Down Munich Cowboys');
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const game = await setupGame();
    const onSaved = vi.fn();

    render(<FirstDownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `FirstDownFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('FirstDownFlow – Fehlerbehandlung', () => {
  it('verhindert das Speichern, wenn der ausgewählte Spieler nicht mehr existiert', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(<FirstDownFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));

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

    render(<FirstDownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('Simulierter Speicherfehler')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.events.count()).toBe(0);

    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);

    createEventSpy.mockRestore();
  });
});

describe('FirstDownFlow – Halbzeit', () => {
  it('verwendet die aktuell gültige Halbzeit aus dem Spielstatus', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);
    const onSaved = vi.fn();

    render(<FirstDownFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [savedEvent] = await db.events.toArray();
    expect(savedEvent?.half).toBe(1);
  });
});
