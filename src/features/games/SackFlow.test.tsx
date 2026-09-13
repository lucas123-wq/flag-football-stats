import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../data/db';
import { createPlayer } from '../../data/players';
import { createGame } from '../../data/games';
import { calculatePlayerStats } from '../../domain/stats';
import { calculateScore } from '../../domain/scoring';
import { EVENT_TYPE, GAME_STATUS, TEAM } from '../../domain/types';
import type { Game } from '../../domain/types';
import { SackFlow } from './SackFlow';
import * as eventsRepo from '../../data/events';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

async function setupGame(): Promise<Game> {
  return createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
}

describe('SackFlow – eigener Sack', () => {
  it('zeigt nur aktive Spieler zur Auswahl', async () => {
    const game = await setupGame();
    await createPlayer({ firstName: 'Hans', lastName: 'Beispiel', jerseyNumber: 44 });
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    render(<SackFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText('Welcher Spieler hat den Sack erzielt?')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '#44 Hans Beispiel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alter Spieler/ })).not.toBeInTheDocument();
  });

  it('zeigt die Bestätigungsseite und speichert vorher kein Event; Abbrechen speichert nichts', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Hans', lastName: 'Beispiel', jerseyNumber: 44 });
    const onCancel = vi.fn();

    render(<SackFlow game={game} team={TEAM.PHOENIX} onCancel={onCancel} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));

    expect(await screen.findByText('Sack Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('#44 Hans Beispiel')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);

    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN SACK-Event mit 0 Punkten, unverändertem Score, korrekter Statistik und WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });
    const onSaved = vi.fn();

    render(<SackFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: scorer.id,
      points: 0,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 0 });
    expect(calculatePlayerStats(events, scorer.id).sacks).toBe(1);
    expect(onSaved).toHaveBeenCalledWith('Sack Regensburg Phoenix #44 Hans Beispiel');
  });
});

describe('SackFlow – Gegner', () => {
  it('zeigt keine Spielerauswahl und speichert genau EIN gegnerisches Event ohne Spielerreferenz', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(<SackFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    expect(await screen.findByText('Sack Munich Cowboys')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ team: TEAM.OPPONENT, playerId: null, points: 0 });
    expect(onSaved).toHaveBeenCalledWith('Sack Munich Cowboys');
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const game = await setupGame();
    const onSaved = vi.fn();

    render(<SackFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `SackFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('SackFlow – Fehlerbehandlung', () => {
  it('verhindert das Speichern, wenn der ausgewählte Spieler nicht mehr existiert', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });
    const onSaved = vi.fn();

    render(<SackFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));
    await db.players.delete(scorer.id);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText(/existiert nicht mehr/)).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('zeigt eine Fehlermeldung bei fehlgeschlagenem Speichern und erlaubt einen erneuten Versuch', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();
    const createEventSpy = vi
      .spyOn(eventsRepo, 'createEvent')
      .mockRejectedValueOnce(new Error('Simulierter Speicherfehler'));

    render(<SackFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
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

describe('SackFlow – Halbzeit', () => {
  it('verwendet die aktuell gültige Halbzeit aus dem Spielstatus', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);
    const onSaved = vi.fn();

    render(<SackFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [savedEvent] = await db.events.toArray();
    expect(savedEvent?.half).toBe(1);
  });
});
