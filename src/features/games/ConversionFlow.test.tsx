import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../data/db';
import { createPlayer } from '../../data/players';
import { createGame } from '../../data/games';
import { createEvent } from '../../data/events';
import { calculatePlayerStats } from '../../domain/stats';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from '../../domain/types';
import type { Game } from '../../domain/types';
import { ConversionFlow } from './ConversionFlow';
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

describe('ConversionFlow – eigene 1-Punkt-Conversion, Erfolg', () => {
  it('öffnet die Erfolg/Fehlschlag-Auswahl', async () => {
    const game = await setupGame();
    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByText('Conversion erfolgreich?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erfolgreich' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fehlgeschlagen' })).toBeInTheDocument();
  });

  it('zeigt nach "Erfolgreich" die aktive Spielerauswahl', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));

    expect(await screen.findByRole('button', { name: '#12 Max Mustermann' })).toBeInTheDocument();
  });

  it('zeigt nach Spielerauswahl die Bestätigungsseite und speichert vorher kein Event', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));

    expect(await screen.findByText('1-Punkt-Conversion Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('#12 Max Mustermann')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Abbrechen kein Event', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const onCancel = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={onCancel}
        onSaved={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    const cancelButtons = await screen.findAllByRole('button', { name: 'Abbrechen' });
    await user.click(cancelButtons[cancelButtons.length - 1] as HTMLElement);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Event mit Spieler, Score +1 und korrekter Statistik/WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await seedOwnTouchdown(game.id); // Score vorher 6:0
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const conversionEvents = (await db.events.toArray()).filter(
      (e) => e.type === EVENT_TYPE.CONVERSION_1PT,
    );
    expect(conversionEvents).toHaveLength(1);
    expect(conversionEvents[0]).toMatchObject({
      team: TEAM.PHOENIX,
      playerId: scorer.id,
      successful: true,
      points: 1,
    });

    expect(calculatePlayerStats(conversionEvents, scorer.id).onePointConversions).toBe(1);
    expect(onSaved).toHaveBeenCalledWith(
      '1 Pt Conversion Regensburg Phoenix #12 Max Mustermann\nNeuer Spielstand: 7:0',
    );
  });
});

describe('ConversionFlow – eigene 1-Punkt-Conversion, Fehlschlag', () => {
  it('zeigt nach "Fehlgeschlagen" direkt die Bestätigungsseite ohne Spielerauswahl', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));

    expect(await screen.findByText('1-Punkt-Conversion Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('Fehlgeschlagen')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('speichert bei Bestätigen genau EIN Event ohne Spielerreferenz, unveränderten Score, keine Statistik und den korrekten WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await seedOwnTouchdown(game.id); // Score vorher 6:0
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const conversionEvents = (await db.events.toArray()).filter(
      (e) => e.type === EVENT_TYPE.CONVERSION_1PT,
    );
    expect(conversionEvents).toHaveLength(1);
    expect(conversionEvents[0]).toMatchObject({ playerId: null, successful: false, points: 0 });

    expect(calculatePlayerStats(await db.events.toArray(), player.id).onePointConversions).toBe(0);
    expect(onSaved).toHaveBeenCalledWith('1 Pt Conversion Regensburg Phoenix – nicht gut');
  });
});

describe('ConversionFlow – eigene 2-Punkt-Conversion', () => {
  it('speichert bei Erfolg genau EIN Event mit Spieler, Score +2 und korrekter Statistik/WhatsApp-Text', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await seedOwnTouchdown(game.id);
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="2PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const conversionEvents = (await db.events.toArray()).filter(
      (e) => e.type === EVENT_TYPE.CONVERSION_2PT,
    );
    expect(conversionEvents[0]).toMatchObject({ playerId: scorer.id, successful: true, points: 2 });
    expect(calculatePlayerStats(conversionEvents, scorer.id).twoPointConversions).toBe(1);
    expect(onSaved).toHaveBeenCalledWith(
      '2 Pt Conversion Regensburg Phoenix #12 Max Mustermann\nNeuer Spielstand: 8:0',
    );
  });

  it('speichert bei Fehlschlag genau EIN Event ohne Spielerreferenz und unveränderten Score', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    await seedOwnTouchdown(game.id);
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="2PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const conversionEvents = (await db.events.toArray()).filter(
      (e) => e.type === EVENT_TYPE.CONVERSION_2PT,
    );
    expect(conversionEvents[0]).toMatchObject({ playerId: null, successful: false, points: 0 });
    expect(onSaved).toHaveBeenCalledWith('2 Pt Conversion Regensburg Phoenix – nicht gut');
  });
});

describe('ConversionFlow – Gegner (1-Punkt und 2-Punkt)', () => {
  it.each(['1PT', '2PT'] as const)(
    '%s: keine Spielerauswahl, Erfolg speichert korrekt und erhöht den Gegner-Score',
    async (conversionType) => {
      const user = userEvent.setup();
      const game = await setupGame();
      await seedOwnTouchdown(game.id); // Score vorher 6:0
      await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
      const onSaved = vi.fn();

      render(
        <ConversionFlow
          game={game}
          team={TEAM.OPPONENT}
          conversionType={conversionType}
          onCancel={vi.fn()}
          onSaved={onSaved}
        />,
      );
      await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));

      // Keine Spielerauswahl – direkt die Bestätigungsseite (eigenes,
      // von der WhatsApp-Nachricht unabhängiges UI-Label, siehe
      // `ConversionFlow.tsx#CONVERSION_LABEL`).
      const uiLabel = conversionType === '1PT' ? '1-Punkt-Conversion' : '2-Punkt-Conversion';
      expect(await screen.findByText(`${uiLabel} Munich Cowboys`)).toBeInTheDocument();
      expect(await db.events.count()).toBe(1); // nur der gesäte Touchdown

      await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

      await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      const type = conversionType === '1PT' ? EVENT_TYPE.CONVERSION_1PT : EVENT_TYPE.CONVERSION_2PT;
      const [conversionEvent] = (await db.events.toArray()).filter((e) => e.type === type);
      expect(conversionEvent).toMatchObject({
        team: TEAM.OPPONENT,
        playerId: null,
        successful: true,
      });

      // Keine eigenen Spielerstatistiken durch ein gegnerisches Event.
      const allEvents = await db.events.toArray();
      const player = (await db.players.toArray())[0]!;
      const stats = calculatePlayerStats(allEvents, player.id);
      expect(stats.onePointConversions).toBe(0);
      expect(stats.twoPointConversions).toBe(0);

      const expectedPhoenix = 6;
      const expectedOpponent = conversionType === '1PT' ? 1 : 2;
      // WhatsApp-Wortlaut exakt aus der PRD (§18/§19: "1/2 Pt Conversion").
      const whatsappLabel = conversionType === '1PT' ? '1 Pt Conversion' : '2 Pt Conversion';
      expect(onSaved).toHaveBeenCalledWith(
        `${whatsappLabel} Munich Cowboys\nNeuer Spielstand: ${expectedPhoenix}:${expectedOpponent}`,
      );
    },
  );

  it.each(['1PT', '2PT'] as const)(
    '%s: keine Spielerauswahl, Fehlschlag speichert korrekt ohne Score-Änderung',
    async (conversionType) => {
      const user = userEvent.setup();
      const game = await setupGame();
      const onSaved = vi.fn();

      render(
        <ConversionFlow
          game={game}
          team={TEAM.OPPONENT}
          conversionType={conversionType}
          onCancel={vi.fn()}
          onSaved={onSaved}
        />,
      );
      await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
      // Eigenes UI-Label der Bestätigungsseite (unverändert, nicht Teil der
      // WhatsApp-Nachricht) – siehe `ConversionFlow.tsx#CONVERSION_LABEL`.
      const uiLabel = conversionType === '1PT' ? '1-Punkt-Conversion' : '2-Punkt-Conversion';
      expect(await screen.findByText(`${uiLabel} Munich Cowboys`)).toBeInTheDocument();
      expect(screen.getByText('Fehlgeschlagen')).toBeInTheDocument();

      await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

      await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      const [conversionEvent] = await db.events.toArray();
      expect(conversionEvent).toMatchObject({
        team: TEAM.OPPONENT,
        playerId: null,
        successful: false,
        points: 0,
      });
      // WhatsApp-Wortlaut exakt aus der PRD (§18/§19): einzeilig, "nicht gut",
      // ohne Spielstand-Zeile (Score ändert sich bei einem Fehlschlag nie).
      const whatsappLabel = conversionType === '1PT' ? '1 Pt Conversion' : '2 Pt Conversion';
      expect(onSaved).toHaveBeenCalledWith(`${whatsappLabel} Munich Cowboys – nicht gut`);
    },
  );
});

describe('ConversionFlow – Doppelklick-Schutz', () => {
  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Bestätigen" nur EIN einziges Event', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.OPPONENT}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    const button = await screen.findByRole('button', { name: 'Bestätigen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks – prüft den
    // `actionGuard`-Schutz aus `useActionGuard` (siehe `ConversionFlow.tsx`).
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await db.events.count()).toBe(1);
  });
});

describe('ConversionFlow – Fehlerbehandlung', () => {
  it('verhindert das Speichern, wenn der ausgewählte Spieler nicht mehr existiert', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    const scorer = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.PHOENIX}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
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

    render(
      <ConversionFlow
        game={game}
        team={TEAM.OPPONENT}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('Simulierter Speicherfehler')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.events.count()).toBe(0);

    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledTimes(1);

    createEventSpy.mockRestore();
  });
});

describe('ConversionFlow – Halbzeit', () => {
  it('verwendet die aktuell gültige Halbzeit aus dem Spielstatus', async () => {
    const user = userEvent.setup();
    const game = await setupGame();
    expect(game.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);
    const onSaved = vi.fn();

    render(
      <ConversionFlow
        game={game}
        team={TEAM.OPPONENT}
        conversionType="1PT"
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [savedEvent] = await db.events.toArray();
    expect(savedEvent?.half).toBe(1);
  });
});
