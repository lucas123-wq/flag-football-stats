import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../data/db';
import { createGame } from '../../data/games';
import { EVENT_TYPE, GAME_STATUS, TEAM } from '../../domain/types';
import type { Game } from '../../domain/types';
import { TurnoverOnDownsFlow } from './TurnoverOnDownsFlow';
import * as eventsRepo from '../../data/events';

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.events.clear();
});

async function setupGame(): Promise<Game> {
  return createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
}

// NEGATIVE Statistik: `team={TEAM.PHOENIX}` bedeutet, dass die EIGENE
// Offense den Ball bei Downs verliert (nicht, dass Phoenix ihn bekommt) –
// siehe `domain/turnoverOnDowns.ts`.
describe('TurnoverOnDownsFlow – eigenes Team verliert den Ball bei Downs', () => {
  it('zeigt direkt die Bestätigungsseite ohne Spielerauswahl ("kein Spieler wird ausgewählt")', async () => {
    const game = await setupGame();
    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(await screen.findByText('Turnover on Downs Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.queryByText(/Welcher Spieler/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Event mit team=PHOENIX, ohne Spieler, 0 Punkten, unverändertem Score und korrektem WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      gameId: game.id,
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.PHOENIX,
      playerId: null,
      points: 0,
    });
    // Kein zusätzliches INTERCEPTION-Event.
    expect(events.some((e) => e.type === EVENT_TYPE.INTERCEPTION)).toBe(false);

    expect(onSaved).toHaveBeenCalledWith('Turnover on Downs Regensburg Phoenix');
  });

  it('bricht über "Abbrechen" ab, ohne ein Event zu speichern', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onCancel = vi.fn();

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.PHOENIX} onCancel={onCancel} onSaved={vi.fn()} />,
    );
    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });
});

// `team={TEAM.OPPONENT}` bedeutet, dass der GEGNER den Ball bei Downs
// verliert (nicht, dass der Gegner ihn bekommt).
describe('TurnoverOnDownsFlow – Gegner verliert den Ball bei Downs', () => {
  it('zeigt direkt die Bestätigungsseite ohne Spielerauswahl', async () => {
    const game = await setupGame();
    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(await screen.findByText('Turnover on Downs Munich Cowboys')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Event mit team=OPPONENT, ohne Spieler, 0 Punkten und korrektem WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 0,
    });
    expect(events.some((e) => e.type === EVENT_TYPE.INTERCEPTION)).toBe(false);
    expect(onSaved).toHaveBeenCalledWith('Turnover on Downs Munich Cowboys');
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />,
    );
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `TurnoverOnDownsFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('TurnoverOnDownsFlow – Score/Statistik', () => {
  it('ändert den Score nicht (0 Punkte, keine Score-Änderung)', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const events = await db.events.toArray();
    const totalPoints = events.reduce((sum, e) => sum + e.points, 0);
    expect(totalPoints).toBe(0);
  });
});

describe('TurnoverOnDownsFlow – Fehlerbehandlung', () => {
  it('zeigt eine verständliche Fehlermeldung, wenn das Speichern fehlschlägt, und erlaubt einen erneuten Versuch', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    const createEventSpy = vi
      .spyOn(eventsRepo, 'createEvent')
      .mockRejectedValueOnce(new Error('Simulierter Speicherfehler'));

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.OPPONENT} onCancel={vi.fn()} onSaved={onSaved} />,
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

describe('TurnoverOnDownsFlow – Halbzeit', () => {
  it('verwendet die aktuell gültige Halbzeit aus dem Spielstatus', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);
    const onSaved = vi.fn();

    render(
      <TurnoverOnDownsFlow game={game} team={TEAM.PHOENIX} onCancel={vi.fn()} onSaved={onSaved} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [savedEvent] = await db.events.toArray();
    expect(savedEvent?.half).toBe(1);
  });
});
