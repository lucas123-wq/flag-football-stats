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
import { PickFlow } from './PickFlow';
import * as eventsRepo from '../../data/events';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

async function setupGame(): Promise<Game> {
  return createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
}

describe('PickFlow – Pick 6, eigenes Team', () => {
  it('zeigt nur aktive Spieler zur Auswahl', async () => {
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    render(
      <PickFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SIX"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByText('Welcher Spieler hat den Pick 6 erzielt?')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '#23 Max Muster' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alter Spieler/ })).not.toBeInTheDocument();
  });

  it('zeigt die Bestätigungsseite und speichert vorher kein Event; Abbrechen speichert nichts', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });
    const onCancel = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SIX"
        onCancel={onCancel}
        onSaved={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));

    expect(await screen.findByText('Pick 6 Regensburg Phoenix')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);

    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN PICK_6-Event mit +6 Punkten, KEIN zusätzliches INTERCEPTION-Event, korrekte Statistik und WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SIX"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();

    // Event-Integritätsregel: exakt 1 Event, Typ PICK_6, 6 Punkte, KEIN INTERCEPTION.
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.PICK_6);
    expect(events[0]).toMatchObject({ team: TEAM.PHOENIX, playerId: scorer.id, points: 6 });
    expect(events.some((e) => e.type === EVENT_TYPE.INTERCEPTION)).toBe(false);

    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
    const stats = calculatePlayerStats(events, scorer.id);
    expect(stats.pickSixes).toBe(1);
    expect(stats.interceptions).toBe(0);
    expect(onSaved).toHaveBeenCalledWith(
      'Pick 6 Regensburg Phoenix #23 Max Muster\nNeuer Spielstand: 6:0',
    );
  });
});

describe('PickFlow – Pick 2, eigenes Team', () => {
  it('speichert bei Bestätigen genau EIN PICK_2-Event mit +2 Punkten, KEIN zusätzliches INTERCEPTION-Event, korrekte Statistik und WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="TWO"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.PICK_2);
    expect(events[0]).toMatchObject({ team: TEAM.PHOENIX, playerId: scorer.id, points: 2 });
    expect(events.some((e) => e.type === EVENT_TYPE.INTERCEPTION)).toBe(false);

    expect(calculateScore(events)).toEqual({ phoenix: 2, opponent: 0 });
    const stats = calculatePlayerStats(events, scorer.id);
    expect(stats.pickTwos).toBe(1);
    expect(stats.interceptions).toBe(0);
    expect(onSaved).toHaveBeenCalledWith(
      'Pick 2 Regensburg Phoenix #23 Max Muster\nNeuer Spielstand: 2:0',
    );
  });
});

describe('PickFlow – Gegner', () => {
  it('Pick 6: keine Spielerauswahl, korrektes Event, Gegner-Score +6', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SIX"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByText('Pick 6 Munich Cowboys')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.PICK_6,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 6,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 6 });
    expect(onSaved).toHaveBeenCalledWith('Pick 6 Munich Cowboys\nNeuer Spielstand: 0:6');
  });

  it('Pick 2: keine Spielerauswahl, korrektes Event, Gegner-Score +2', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="TWO"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.PICK_2,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 2,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 2 });
    expect(onSaved).toHaveBeenCalledWith('Pick 2 Munich Cowboys\nNeuer Spielstand: 0:2');
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SIX"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `PickFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('PickFlow – Fehlerbehandlung', () => {
  it('verhindert das Speichern, wenn der ausgewählte Spieler nicht mehr existiert', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SIX"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
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

    render(
      <PickFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="TWO"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
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

describe('PickFlow – Halbzeit', () => {
  it('verwendet die aktuell gültige Halbzeit aus dem Spielstatus', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);
    const onSaved = vi.fn();

    render(
      <PickFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SIX"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [savedEvent] = await db.events.toArray();
    expect(savedEvent?.half).toBe(1);
  });
});
