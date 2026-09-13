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
import { SafetyFlow } from './SafetyFlow';
import * as eventsRepo from '../../data/events';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

async function setupGame(): Promise<Game> {
  return createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
}

describe('SafetyFlow – Safety, eigenes Team', () => {
  it('zeigt nur aktive Spieler zur Auswahl', async () => {
    const game = await setupGame();
    await createPlayer({ firstName: 'Hans', lastName: 'Beispiel', jerseyNumber: 44 });
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    render(
      <SafetyFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SAFETY"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByText('Welcher Spieler hat die Safety erzielt?')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '#44 Hans Beispiel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alter Spieler/ })).not.toBeInTheDocument();
  });

  it('zeigt die Bestätigungsseite und speichert vorher kein Event; Abbrechen speichert nichts', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Hans', lastName: 'Beispiel', jerseyNumber: 44 });
    const onCancel = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SAFETY"
        onCancel={onCancel}
        onSaved={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));

    expect(await screen.findByText('Safety Regensburg Phoenix')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);

    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN SAFETY-Event mit +2 Punkten, korrekter Statistik und WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SAFETY"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.SAFETY,
      team: TEAM.PHOENIX,
      playerId: scorer.id,
      points: 2,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 2, opponent: 0 });
    expect(calculatePlayerStats(events, scorer.id).safeties).toBe(1);
    expect(onSaved).toHaveBeenCalledWith(
      'Safety Regensburg Phoenix #44 Hans Beispiel\nNeuer Spielstand: 2:0',
    );
  });
});

describe('SafetyFlow – 1-Punkt-Safety, eigenes Team', () => {
  it('speichert bei Bestätigen genau EIN SAFETY_1PT-Event mit +1 Punkt, korrekter Statistik und WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SAFETY_1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.SAFETY_1PT,
      team: TEAM.PHOENIX,
      playerId: scorer.id,
      points: 1,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 1, opponent: 0 });
    expect(calculatePlayerStats(events, scorer.id).onePointSafeties).toBe(1);
    expect(onSaved).toHaveBeenCalledWith(
      '1 Pt Safety Regensburg Phoenix #44 Hans Beispiel\nNeuer Spielstand: 1:0',
    );
  });
});

describe('SafetyFlow – Gegner', () => {
  it('Safety: keine Spielerauswahl, korrektes Event, Gegner-Score +2', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SAFETY"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByText('Safety Munich Cowboys')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.SAFETY,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 2,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 2 });
    expect(onSaved).toHaveBeenCalledWith('Safety Munich Cowboys\nNeuer Spielstand: 0:2');
  });

  it('1-Punkt-Safety: keine Spielerauswahl, korrektes Event, Gegner-Score +1', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SAFETY_1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.SAFETY_1PT,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 1,
    });
    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 1 });
    expect(onSaved).toHaveBeenCalledWith('1 Pt Safety Munich Cowboys\nNeuer Spielstand: 0:1');
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SAFETY"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `SafetyFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('SafetyFlow – Fehlerbehandlung', () => {
  it('verhindert das Speichern, wenn der ausgewählte Spieler nicht mehr existiert', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.PHOENIX}
        variant="SAFETY"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
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

    render(
      <SafetyFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SAFETY_1PT"
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

describe('SafetyFlow – Halbzeit', () => {
  it('verwendet die aktuell gültige Halbzeit aus dem Spielstatus', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);
    const onSaved = vi.fn();

    render(
      <SafetyFlow
        game={game}
        team={TEAM.OPPONENT}
        variant="SAFETY"
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
