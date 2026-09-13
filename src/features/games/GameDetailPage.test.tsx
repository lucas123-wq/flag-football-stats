import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../data/db';
import { createEvent } from '../../data/events';
import { createGame, setGameStatus } from '../../data/games';
import { createPlayer, updatePlayer } from '../../data/players';
import {
  buildGameEndEvent,
  buildHalftimeEvent,
  buildSecondHalfStartEvent,
  buildTwoMinuteWarningEvent,
} from '../../domain/gameFlow';
import { calculateScore } from '../../domain/scoring';
import { calculatePlayerStats } from '../../domain/stats';
import { EVENT_TYPE, GAME_STATUS, HALF, TEAM } from '../../domain/types';
import App from '../../App';

beforeEach(async () => {
  await db.games.clear();
  await db.events.clear();
  await db.players.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/**
 * Bei `FINAL` ersetzt die Tab-Struktur (PRD §37) den Live-Screen; Bearbeiten-
 * /Löschen-Buttons sowie der vollständige Liveticker sind erst nach dem
 * Wechsel auf den entsprechenden Tab erreichbar.
 */
async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('tab', { name }));
}

/**
 * Wartet auf die WhatsApp-Box (`data-testid="whatsapp-message"`) mit dem
 * angegebenen (Teil-)Text und gibt sie zurück. Seit der PRD-Wortlaut-
 * Angleichung (Halbzeit/2-Minuten-Warnung/Spielende) beginnt der WhatsApp-
 * Text mit demselben Wort wie der zugehörige Liveticker-Titel (z. B.
 * "Halbzeit") – ein einfaches `screen.findByText('Halbzeit', {exact:false})`
 * wäre daher mit dem separaten Liveticker-Eintrag mehrdeutig. Das gezielte
 * Warten auf den Textinhalt DIESER Box (statt nur auf ihre Existenz) stellt
 * außerdem sicher, dass bei einer zweiten Aktion im selben Test nicht
 * versehentlich der noch alte Nachrichtentext geprüft wird.
 */
async function findWhatsAppMessage(expectedText: string) {
  await waitFor(() => {
    expect(screen.getByTestId('whatsapp-message')).toHaveTextContent(expectedText);
  });
  return screen.getByTestId('whatsapp-message');
}

describe('GameDetailPage – Grundlegende Spieldaten', () => {
  it('lädt ein vorhandenes Spiel und zeigt den Gegnernamen an', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);

    expect(await screen.findByText('Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('Munich Cowboys')).toBeInTheDocument();
    expect(screen.getByText('12.09.2026')).toBeInTheDocument();
  });

  it('zeigt den initialen Spielstand 0 : 0 an', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
  });

  it.each([
    [GAME_STATUS.LIVE_FIRST_HALF, '1. Halbzeit'],
    [GAME_STATUS.HALFTIME, 'Halbzeit'],
    [GAME_STATUS.LIVE_SECOND_HALF, '2. Halbzeit'],
    [GAME_STATUS.FINAL, 'Beendet'],
  ])('zeigt den Spielstatus %s korrekt als "%s" an', async (status, expectedLabel) => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, status);

    renderAt(`/spiele/${game.id}`);

    expect(await screen.findByText(expectedLabel)).toBeInTheDocument();
  });

  it('zeigt eine Fehlermeldung mit Rückweg für eine unbekannte Spiel-ID', async () => {
    renderAt('/spiele/unbekannte-id');

    expect(await screen.findByText('Spiel wurde nicht gefunden.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zurück zu Spielen' })).toHaveAttribute(
      'href',
      '/spiele',
    );
  });

  it('die "Zurück zu Spielen"-Navigation führt zur Spieleliste', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('link', { name: '← Zurück zu Spielen' }));

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
  });
});

describe('GameDetailPage – Event-Buttons (Platzhalter)', () => {
  const OWN_TEAM_LABELS = [
    'Touchdown',
    '1-Punkt-Conversion',
    '2-Punkt-Conversion',
    'First Down',
    'Interception',
    'Pick 6',
    'Pick 2',
    'Sack',
    'Safety',
    '1-Punkt-Safety',
    'Turnover on Downs',
  ];

  it('zeigt alle vorgesehenen Buttons für die eigene Mannschaft und den Gegner', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await screen.findByText('Regensburg Phoenix');

    for (const label of OWN_TEAM_LABELS) {
      // Jedes Label existiert doppelt (eigene Mannschaft + Gegner).
      expect(screen.getAllByRole('button', { name: label })).toHaveLength(2);
    }
  });

  // Hinweis: Alle elf Event-Typen der Eigene-Mannschaft-/Gegner-Buttons
  // (inkl. Turnover on Downs) sind real implementiert – es gibt aktuell
  // keinen verbleibenden Platzhalter-Button mehr im Live-Spielbildschirm.
  it('öffnet den echten Flow beim Klick auf einen Event-Button und speichert vorher KEIN Event', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const sackButtons = await screen.findAllByRole('button', { name: 'Sack' });
    await user.click(sackButtons[0] as HTMLElement);

    expect(await screen.findByText('Welcher Spieler hat den Sack erzielt?')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('verändert beim Öffnen eines Event-Flows NICHT den angezeigten Spielstand', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const sackButtons = await screen.findAllByRole('button', { name: 'Sack' });
    await user.click(sackButtons[0] as HTMLElement);

    expect(screen.getByText('0 : 0')).toBeInTheDocument();
  });

  it('zeigt bei beendetem Spiel keine Event-Buttons mehr (ersetzt durch die Tab-Struktur, PRD §37)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);

    await screen.findByRole('tablist', { name: 'Spielansicht' });
    expect(screen.queryByRole('button', { name: 'Touchdown' })).not.toBeInTheDocument();
  });
});

describe('GameDetailPage – Touchdown-Integration', () => {
  it('öffnet den Touchdown-Flow über den eigenen Button und zeigt den neuen Spielstand nach dem Speichern', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('0 : 0')).toBeInTheDocument();

    const ownTouchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(ownTouchdownButtons[0] as HTMLElement);

    expect(await screen.findByText('Art des Touchdowns')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
    expect(
      screen.getByText('Touchdown Regensburg Phoenix #12 Max Mustermann', { exact: false }),
    ).toBeInTheDocument();
  });

  it('öffnet den Touchdown-Flow über den Gegner-Button ohne Spielerauswahl und aktualisiert den Gegner-Score', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const touchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    // Zweiter Button gehört zum Abschnitt "Gegner".
    await user.click(touchdownButtons[1] as HTMLElement);

    expect(await screen.findByText('Touchdown Munich Cowboys')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 6')).toBeInTheDocument();
  });

  it('bietet nach dem Speichern einen Kopieren-Button für den WhatsApp-Text', async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const touchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtons[1] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    const copyButton = await screen.findByRole('button', { name: 'Kopieren' });
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith('Touchdown Munich Cowboys\nNeuer Spielstand: 0:6');
    expect(await screen.findByRole('button', { name: 'Kopiert ✓' })).toBeInTheDocument();
  });

  it('bricht den Touchdown-Flow über "Abbrechen" ab, ohne den Spielstand zu ändern', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const touchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtons[1] as HTMLElement);
    await screen.findByText('Touchdown Munich Cowboys');

    // Der Header-"Abbrechen"-Button des Flows (nicht der Bestätigungsseite).
    await user.click(screen.getAllByRole('button', { name: 'Abbrechen' })[0] as HTMLElement);

    expect(screen.queryByText('Touchdown Munich Cowboys')).not.toBeInTheDocument();
    expect(screen.getByText('0 : 0')).toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });
});

describe('GameDetailPage – Conversion-Integration', () => {
  it('öffnet den 1-Punkt-Conversion-Flow über den eigenen Button und aktualisiert den Score nach dem Speichern', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 6,
      half: HALF.FIRST,
    });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();

    const ownConversionButtons = await screen.findAllByRole('button', {
      name: '1-Punkt-Conversion',
    });
    await user.click(ownConversionButtons[0] as HTMLElement);

    expect(await screen.findByText('Conversion erfolgreich?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Erfolgreich' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('7 : 0')).toBeInTheDocument();
    // PRD §18: exakter Wortlaut "1 Pt Conversion" (WhatsApp-Text).
    expect(
      screen.getByText('1 Pt Conversion Regensburg Phoenix #12 Max Mustermann', {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it('öffnet den 2-Punkt-Conversion-Flow über den Gegner-Button ohne Spielerauswahl und aktualisiert den Gegner-Score', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const opponentConversionButtons = await screen.findAllByRole('button', {
      name: '2-Punkt-Conversion',
    });
    await user.click(opponentConversionButtons[1] as HTMLElement);

    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
    expect(await screen.findByText('2-Punkt-Conversion Munich Cowboys')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 2')).toBeInTheDocument();
  });

  it('lässt Touchdown-Buttons nach einer Conversion weiterhin unverändert funktionieren', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);

    // Gegnerische 1-Punkt-Conversion (Fehlschlag, keine Vorbedingung nötig).
    const conversionButtons = await screen.findAllByRole('button', {
      name: '1-Punkt-Conversion',
    });
    await user.click(conversionButtons[1] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByText('0 : 0')).toBeInTheDocument();

    // Danach eigener Rushing-Touchdown wie in Schritt 6.
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const touchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtons[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
  });
});

describe('GameDetailPage – First-Down-Integration', () => {
  it('öffnet den First-Down-Flow über den eigenen Button und lässt den Score unverändert', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 6,
      half: HALF.FIRST,
    });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();

    const ownFirstDownButtons = await screen.findAllByRole('button', { name: 'First Down' });
    await user.click(ownFirstDownButtons[0] as HTMLElement);

    expect(
      await screen.findByText('Welcher Spieler hat den First Down erzielt?'),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    // Score bleibt unverändert bei 6:0.
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
    // Kein Spielstand in der Nachricht, da First Down den Score nicht ändert.
    expect(
      await screen.findByText('First Down Regensburg Phoenix #12 Max Mustermann'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Spielstand/)).not.toBeInTheDocument();
  });

  it('öffnet den First-Down-Flow über den Gegner-Button ohne Spielerauswahl und lässt den Score unverändert', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const firstDownButtons = await screen.findAllByRole('button', { name: 'First Down' });
    await user.click(firstDownButtons[1] as HTMLElement);

    expect(await screen.findByText('First Down Munich Cowboys')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    // Kein Spielstand in der Nachricht, da First Down den Score nicht ändert.
    // "First Down Munich Cowboys" erscheint jetzt zusätzlich als eigener
    // Liveticker-Titel (§39, da der Gegner keinen Spieler hat und die
    // WhatsApp-Nachricht dadurch nur aus dieser einen Zeile besteht) – daher
    // gezielt auf die WhatsApp-Box scopen.
    expect(await screen.findByTestId('whatsapp-message')).toHaveTextContent(
      'First Down Munich Cowboys',
    );
    expect(screen.queryByText(/Spielstand/)).not.toBeInTheDocument();
  });
});

describe('GameDetailPage – Interception/Pick/Sack/Safety-Integration', () => {
  it('öffnet den Interception-Flow über den eigenen Button, speichert ohne Score-Änderung', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Interception' });
    await user.click(buttons[0] as HTMLElement);

    expect(
      await screen.findByText('Welcher Spieler hat die Interception gefangen?'),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    expect(
      await screen.findByText('Interception Regensburg Phoenix #23 Max Muster'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Spielstand/)).not.toBeInTheDocument();
  });

  it('öffnet den Pick-6-Flow über den eigenen Button und erhöht den Score um 6', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Pick 6' });
    await user.click(buttons[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
    expect(
      screen.getByText('Pick 6 Regensburg Phoenix #23 Max Muster', { exact: false }),
    ).toBeInTheDocument();
  });

  it('öffnet den Pick-2-Flow über den Gegner-Button ohne Spielerauswahl und erhöht den Gegner-Score um 2', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Pick 2' });
    await user.click(buttons[1] as HTMLElement);

    expect(await screen.findByText('Pick 2 Munich Cowboys')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 2')).toBeInTheDocument();
  });

  it('öffnet den Sack-Flow über den Gegner-Button ohne Score-Änderung', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Sack' });
    await user.click(buttons[1] as HTMLElement);

    expect(await screen.findByText('Sack Munich Cowboys')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    // Nach dem Speichern erscheint "Sack Munich Cowboys" sowohl im
    // WhatsApp-Text als auch als eigener Liveticker-Eintrag (§39) – daher
    // gezielt auf die WhatsApp-Box scopen statt auf den Text allgemein.
    expect(await screen.findByTestId('whatsapp-message')).toHaveTextContent('Sack Munich Cowboys');
  });

  it('öffnet den Safety-Flow über den eigenen Button und erhöht den Score um 2', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Hans', lastName: 'Beispiel', jerseyNumber: 44 });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Safety' });
    await user.click(buttons[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: '#44 Hans Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('2 : 0')).toBeInTheDocument();
  });

  it('öffnet den 1-Punkt-Safety-Flow über den Gegner-Button und erhöht den Gegner-Score um 1', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: '1-Punkt-Safety' });
    await user.click(buttons[1] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 1')).toBeInTheDocument();
  });

  it('lässt Touchdown weiterhin unverändert funktionieren, nachdem andere neue Events verdrahtet wurden', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);
    const touchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtons[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
  });
});

// NEGATIVE Statistik (Korrektur): der Eigene-Mannschaft-Button wird
// geklickt, wenn die EIGENE Offense den Ball bei Downs verliert (nicht,
// wenn Phoenix ihn bekommt) – siehe `domain/turnoverOnDowns.ts`.
describe('GameDetailPage – Turnover-on-Downs-Integration', () => {
  it('öffnet den Turnover-on-Downs-Flow über den eigenen Button (eigene Offense verliert den Ball bei Downs) ohne Spielerauswahl, speichert ohne Score-Änderung', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Turnover on Downs' });
    await user.click(buttons[0] as HTMLElement);

    expect(await screen.findByText('Turnover on Downs Regensburg Phoenix')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.PHOENIX,
      playerId: null,
      points: 0,
    });
  });

  it('öffnet den Turnover-on-Downs-Flow über den Gegner-Button (Gegner-Offense verliert den Ball bei Downs) ohne Spielerauswahl, speichert ohne Score-Änderung', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const buttons = await screen.findAllByRole('button', { name: 'Turnover on Downs' });
    await user.click(buttons[1] as HTMLElement);

    expect(await screen.findByText('Turnover on Downs Munich Cowboys')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.OPPONENT,
      playerId: null,
      points: 0,
    });
    // Nach dem Speichern erscheint "Turnover on Downs Munich Cowboys" sowohl
    // im WhatsApp-Text als auch als eigener Liveticker-Eintrag (§39) – daher
    // gezielt auf die WhatsApp-Box scopen statt auf den Text allgemein.
    expect(await screen.findByTestId('whatsapp-message')).toHaveTextContent(
      'Turnover on Downs Munich Cowboys',
    );
  });

  it('zeigt den Turnover-on-Downs-Eintrag im Liveticker', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.PHOENIX,
      points: 0,
      half: HALF.FIRST,
    });

    renderAt(`/spiele/${game.id}`);
    // Auf den tatsächlichen Ticker-Eintrag warten (hängt von der Events-
    // `useLiveQuery` ab), nicht nur auf die statische Überschrift
    // "Letzte Events" (vermeidet einen Timing-Flake unter Last).
    expect(await screen.findByText('Turnover on Downs Regensburg Phoenix')).toBeInTheDocument();
  });

  it('lässt Touchdown weiterhin unverändert funktionieren, nachdem Turnover on Downs verdrahtet wurde', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);
    const touchdownButtons = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtons[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
  });
});

describe('GameDetailPage – Halbzeit', () => {
  it('ändert den Status auf HALFTIME, erzeugt eine Nachricht mit Spielstand und speichert ein HALFTIME-Event (PRD §28)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 6,
      half: HALF.FIRST,
    });

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));

    // PRD §28: exakter Wortlaut "Halbzeit\nRegensburg Phoenix X:Y Gegner".
    const message = await findWhatsAppMessage('Halbzeit');
    expect(message).toHaveTextContent('Regensburg Phoenix 6:0 Munich Cowboys');

    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.HALFTIME);

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe(EVENT_TYPE.TOUCHDOWN_RUSHING);
    const halftimeEvent = events[1];
    expect(halftimeEvent?.type).toBe(EVENT_TYPE.HALFTIME);
    expect(halftimeEvent?.team).toBeNull();
    expect(halftimeEvent?.playerId).toBeNull();
    expect(halftimeEvent?.points).toBe(0);
    expect(halftimeEvent?.half).toBe(1);
    // Score bleibt unverändert durch das Steuerungs-Event (points: 0, team: null).
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('erzeugt bei einem schnellen Doppelklick nur ein einziges HALFTIME-Event', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const button = await screen.findByRole('button', { name: 'Halbzeit' });
    await user.dblClick(button);

    await findWhatsAppMessage('Halbzeit');
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.HALFTIME);
  });

  it('deaktiviert Event-Buttons und die Halbzeit-Aktion, macht "Weiter geht\'s" verfügbar', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));
    await findWhatsAppMessage('Halbzeit');

    for (const button of screen.getAllByRole('button', { name: 'Touchdown' })) {
      expect(button).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Halbzeit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Weiter geht's" })).toBeInTheDocument();
  });

  it('ist während HALFTIME/LIVE_SECOND_HALF/FINAL nicht verfügbar', async () => {
    for (const status of [GAME_STATUS.HALFTIME, GAME_STATUS.LIVE_SECOND_HALF, GAME_STATUS.FINAL]) {
      const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
      await setGameStatus(game.id, status);
      const { unmount } = renderAt(`/spiele/${game.id}`);
      await screen.findByText('Regensburg Phoenix');
      expect(screen.queryByRole('button', { name: 'Halbzeit' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('bleibt nach einem Reload (Neu-Rendern) als HALFTIME mit deaktivierten Event-Buttons und dem gespeicherten HALFTIME-Event erhalten', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    const first = renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));
    await findWhatsAppMessage('Halbzeit');
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByRole('button', { name: "Weiter geht's" })).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: 'Touchdown' })) {
      expect(button).toBeDisabled();
    }
    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.HALFTIME);
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.HALFTIME);
  });
});

describe("GameDetailPage – Weiter geht's", () => {
  it('ist nur während HALFTIME verfügbar', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    renderAt(`/spiele/${game.id}`);
    await screen.findByText('Regensburg Phoenix');
    expect(screen.queryByRole('button', { name: "Weiter geht's" })).not.toBeInTheDocument();
  });

  it('setzt den Status auf LIVE_SECOND_HALF, speichert ein SECOND_HALF_START-Event mit der PRD-Nachricht und ändert den Score nicht', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.HALFTIME);

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));

    expect(await screen.findByText('2. Halbzeit')).toBeInTheDocument();
    // PRD §30: exakter Wortlaut "Weiter geht's\nRegensburg Phoenix X:Y Gegner"
    // (kein "Spielstand:"-Format wie bei Halbzeit/2-Minuten/Spielende).
    // "Weiter geht's" erscheint jetzt zusätzlich als eigener Liveticker-Titel
    // (§39) – daher gezielt auf die WhatsApp-Box scopen.
    const message = await screen.findByTestId('whatsapp-message');
    expect(message).toHaveTextContent("Weiter geht's");
    expect(message).toHaveTextContent('Regensburg Phoenix 0:0 Munich Cowboys');

    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.LIVE_SECOND_HALF);

    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.SECOND_HALF_START);
    expect(events[0]?.team).toBeNull();
    expect(events[0]?.points).toBe(0);
    expect(events[0]?.half).toBe(2);

    expect(screen.getByText('0 : 0')).toBeInTheDocument();
  });

  it('aktiviert Event-Buttons wieder und macht "Spielende" statt "Halbzeit"/"Weiter geht\'s" verfügbar', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.HALFTIME);

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));
    await screen.findByText('2. Halbzeit');

    for (const button of screen.getAllByRole('button', { name: 'Touchdown' })) {
      expect(button).not.toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Halbzeit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Weiter geht's" })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spielende' })).toBeInTheDocument();
  });

  it('bleibt nach einem Reload als LIVE_SECOND_HALF mit aktiven Event-Buttons und dem gespeicherten SECOND_HALF_START-Event erhalten', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.HALFTIME);

    const first = renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));
    await screen.findByText('2. Halbzeit');
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('2. Halbzeit')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: 'Touchdown' })) {
      expect(button).not.toBeDisabled();
    }
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.SECOND_HALF_START);
  });

  it('Events nach "Weiter geht\'s" bekommen half: 2, Events aus Halbzeit 1 (inkl. der Steuerungs-Events) bleiben half: 1', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);

    // TD in Halbzeit 1.
    const touchdownButtonsH1 = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtonsH1[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();

    // Halbzeit -> Weiter geht's.
    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));
    await findWhatsAppMessage('Halbzeit');
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));
    await screen.findByText('2. Halbzeit');

    // TD in Halbzeit 2.
    const touchdownButtonsH2 = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(touchdownButtonsH2[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByText('12 : 0')).toBeInTheDocument();

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events.map((e) => e.type)).toEqual([
      EVENT_TYPE.TOUCHDOWN_RUSHING,
      EVENT_TYPE.HALFTIME,
      EVENT_TYPE.SECOND_HALF_START,
      EVENT_TYPE.TOUCHDOWN_RUSHING,
    ]);
    expect(events.map((e) => e.half)).toEqual([1, 1, 2, 2]);
  });
});

describe('GameDetailPage – 2-Minuten-Warnung', () => {
  it('ist während LIVE_FIRST_HALF verfügbar, speichert ein TWO_MIN_WARNING-Event (half: 1) und erzeugt die korrekte Nachricht mit Spielstand', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 6,
      half: HALF.FIRST,
    });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: '2 Minuten' }));

    // PRD §27: exakter Wortlaut "2-Minuten-Warnung\nSpielstand: X:Y".
    const message = await findWhatsAppMessage('2-Minuten-Warnung');
    expect(message).toHaveTextContent('Spielstand: 6:0');

    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.LIVE_FIRST_HALF);

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events).toHaveLength(2);
    const warningEvent = events[1];
    expect(warningEvent?.type).toBe(EVENT_TYPE.TWO_MIN_WARNING);
    expect(warningEvent?.team).toBeNull();
    expect(warningEvent?.points).toBe(0);
    expect(warningEvent?.half).toBe(1);
    // Score bleibt unverändert durch das Steuerungs-Event.
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it('ist während LIVE_SECOND_HALF verfügbar und speichert das Event mit half: 2', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: '2 Minuten' }));

    await findWhatsAppMessage('2-Minuten-Warnung');
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.TWO_MIN_WARNING);
    expect(events[0]?.half).toBe(2);
  });

  it('ist während HALFTIME nicht verfügbar', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.HALFTIME);

    renderAt(`/spiele/${game.id}`);
    await screen.findByText('Regensburg Phoenix');
    expect(screen.queryByRole('button', { name: '2 Minuten' })).not.toBeInTheDocument();
  });

  it('ist während FINAL nicht verfügbar', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await screen.findByText('Regensburg Phoenix');
    expect(screen.queryByRole('button', { name: '2 Minuten' })).not.toBeInTheDocument();
  });

  it('erzeugt bei mehrfachem (echtem) Auslösen jedes Mal ein eigenes Event, ohne den Score zu ändern (PRD §27: beliebig oft wiederholbar)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: '2 Minuten' }));
    await findWhatsAppMessage('2-Minuten-Warnung');
    await user.click(await screen.findByRole('button', { name: '2 Minuten' }));
    await findWhatsAppMessage('2-Minuten-Warnung');

    expect(screen.getByText('0 : 0')).toBeInTheDocument();
    const events = await db.events.toArray();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === EVENT_TYPE.TWO_MIN_WARNING)).toBe(true);
    expect(events.every((e) => e.team === null && e.points === 0)).toBe(true);
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks (vor Abschluss des ersten) nur ein einziges Event', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    const button = await screen.findByRole('button', { name: '2 Minuten' });
    // `userEvent.dblClick` wartet intern auf den vollständigen Abschluss des
    // ersten Klicks (inkl. IndexedDB-Schreibvorgang), bevor der zweite Klick
    // ausgelöst wird – das simuliert zwei bewusst nacheinander ausgeführte
    // Klicks, nicht den eigentlich zu testenden Fall eines echten
    // Doppelklicks, bei dem der zweite Klick auftritt, WÄHREND der erste noch
    // läuft. `fireEvent.click` (synchron, ohne auf Promises zu warten) bildet
    // genau dieses Überlappen nach und prüft damit den `actionInFlightRef`-
    // Schutz in `GameDetailPage.tsx`.
    fireEvent.click(button);
    fireEvent.click(button);

    await findWhatsAppMessage('2-Minuten-Warnung');
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.TWO_MIN_WARNING);
  });

  it('bietet nach der Nachricht einen Kopieren-Button (keine automatische Übertragung)', async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: '2 Minuten' }));
    await user.click(await screen.findByRole('button', { name: 'Kopieren' }));

    expect(writeTextMock).toHaveBeenCalledWith('2-Minuten-Warnung\nSpielstand: 0:0');
  });
});

describe('GameDetailPage – Spielende', () => {
  it('ist während LIVE_FIRST_HALF und HALFTIME nicht verfügbar', async () => {
    for (const status of [GAME_STATUS.LIVE_FIRST_HALF, GAME_STATUS.HALFTIME]) {
      const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
      await setGameStatus(game.id, status);
      const { unmount } = renderAt(`/spiele/${game.id}`);
      await screen.findByText('Regensburg Phoenix');
      expect(screen.queryByRole('button', { name: 'Spielende' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('verlangt eine Bestätigung; bei Abbrechen bleibt der Status unverändert und es wird kein Event gespeichert', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Spielende' }));

    expect(window.confirm).toHaveBeenCalled();
    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.LIVE_SECOND_HALF);
    expect(screen.queryByTestId('whatsapp-message')).not.toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('setzt nach Bestätigung FINAL, speichert ein GAME_END-Event (half: 2) und zeigt die korrekte Endspielnachricht mit Endstand', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 6,
      half: HALF.FIRST,
    });

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Spielende' }));

    // PRD §31: exakter Wortlaut "Spielende\nRegensburg Phoenix X:Y Gegner".
    const message = await findWhatsAppMessage('Spielende');
    expect(message).toHaveTextContent('Regensburg Phoenix 6:0 Munich Cowboys');

    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.FINAL);

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe(EVENT_TYPE.TOUCHDOWN_RUSHING);
    const gameEndEvent = events[1];
    expect(gameEndEvent?.type).toBe(EVENT_TYPE.GAME_END);
    expect(gameEndEvent?.team).toBeNull();
    expect(gameEndEvent?.points).toBe(0);
    expect(gameEndEvent?.half).toBe(2);
    // Score/Endstand bleibt unverändert durch das Steuerungs-Event.
    expect(calculateScore(events)).toEqual({ phoenix: 6, opponent: 0 });
  });

  it("versteckt nach FINAL alle Event-Buttons und Halbzeit/Weiter-geht's/2-Minuten/Spielende zugunsten der Tab-Struktur (PRD §37)", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Spielende' }));
    await screen.findByText('Beendet');

    await screen.findByRole('tablist', { name: 'Spielansicht' });
    expect(screen.queryByRole('button', { name: 'Touchdown' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Halbzeit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Weiter geht's" })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2 Minuten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spielende' })).not.toBeInTheDocument();
  });

  it('bleibt nach einem Reload als FINAL mit der Tab-Struktur (ohne Event-Buttons) und dem gespeicherten GAME_END-Event erhalten', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);

    const first = renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Spielende' }));
    await screen.findByText('Beendet');
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('Beendet')).toBeInTheDocument();
    await screen.findByRole('tablist', { name: 'Spielansicht' });
    expect(screen.queryByRole('button', { name: 'Touchdown' })).not.toBeInTheDocument();
    const stored = await db.games.get(game.id);
    expect(stored?.status).toBe(GAME_STATUS.FINAL);
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.GAME_END);
  });

  it('erzeugt bei einem schnellen Doppelklick nur ein einziges GAME_END-Event', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);

    renderAt(`/spiele/${game.id}`);
    const button = await screen.findByRole('button', { name: 'Spielende' });
    await user.dblClick(button);

    await screen.findByText('Beendet');
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(EVENT_TYPE.GAME_END);
  });
});

describe('GameDetailPage – Regression: Halbzeit kombiniert mit Events', () => {
  it('TD in Halbzeit 1 -> Halbzeit -> TD in Halbzeit 2: Score korrekt, Steuerungs-Events vorhanden und score-neutral', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    renderAt(`/spiele/${game.id}`);

    const td1 = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(td1[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));
    await findWhatsAppMessage('Halbzeit');
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));
    await screen.findByText('2. Halbzeit');

    const td2 = await screen.findAllByRole('button', { name: 'Touchdown' });
    await user.click(td2[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Rushing' }));
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('12 : 0')).toBeInTheDocument();

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events.map((e) => e.type)).toEqual([
      EVENT_TYPE.TOUCHDOWN_RUSHING,
      EVENT_TYPE.HALFTIME,
      EVENT_TYPE.SECOND_HALF_START,
      EVENT_TYPE.TOUCHDOWN_RUSHING,
    ]);
    const controlTypes: string[] = [EVENT_TYPE.HALFTIME, EVENT_TYPE.SECOND_HALF_START];
    const controlEvents = events.filter((e) => controlTypes.includes(e.type));
    expect(controlEvents).toHaveLength(2);
    for (const controlEvent of controlEvents) {
      expect(controlEvent.team).toBeNull();
      expect(controlEvent.points).toBe(0);
    }
    // Der Score kommt weiterhin ausschließlich aus den (score-relevanten) Events.
    expect(calculateScore(events)).toEqual({ phoenix: 12, opponent: 0 });
  });

  it("Steuerungs-Events (Halbzeit/2-Minuten/Weiter geht's/Spielende) fließen nicht in calculatePlayerStats oder calculateScore ein", async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    await createEvent(buildHalftimeEvent({ gameId: game.id, half: HALF.FIRST }));
    await createEvent(buildTwoMinuteWarningEvent({ gameId: game.id, half: HALF.FIRST }));
    await createEvent(buildSecondHalfStartEvent({ gameId: game.id, half: HALF.SECOND }));
    await createEvent(buildGameEndEvent({ gameId: game.id, half: HALF.SECOND }));

    const events = await db.events.toArray();
    expect(events).toHaveLength(4);

    expect(calculateScore(events)).toEqual({ phoenix: 0, opponent: 0 });
    expect(calculatePlayerStats(events, player.id)).toEqual({
      rushingTouchdowns: 0,
      passingTouchdowns: 0,
      receivingTouchdowns: 0,
      onePointConversions: 0,
      twoPointConversions: 0,
      firstDowns: 0,
      interceptions: 0,
      pickSixes: 0,
      pickTwos: 0,
      sacks: 0,
      safeties: 0,
      onePointSafeties: 0,
    });
  });

  it('TD H1 + Conversion H1 -> Halbzeit -> TD H2 + Conversion H2: Score, Halbzeiten und Spielerstatistiken korrekt (Steuerungs-Events ohne Einfluss)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    renderAt(`/spiele/${game.id}`);

    const performTdAndConversion = async () => {
      const td = await screen.findAllByRole('button', { name: 'Touchdown' });
      await user.click(td[0] as HTMLElement);
      await user.click(await screen.findByRole('button', { name: 'Rushing' }));
      await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
      await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));

      const conv = await screen.findAllByRole('button', { name: '1-Punkt-Conversion' });
      await user.click(conv[0] as HTMLElement);
      await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
      await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
      await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    };

    await performTdAndConversion();
    expect(await screen.findByText('7 : 0')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));
    await findWhatsAppMessage('Halbzeit');
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));
    await screen.findByText('2. Halbzeit');

    await performTdAndConversion();
    expect(await screen.findByText('14 : 0')).toBeInTheDocument();

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events).toHaveLength(6);
    expect(events.map((e) => e.type)).toEqual([
      EVENT_TYPE.TOUCHDOWN_RUSHING,
      EVENT_TYPE.CONVERSION_1PT,
      EVENT_TYPE.HALFTIME,
      EVENT_TYPE.SECOND_HALF_START,
      EVENT_TYPE.TOUCHDOWN_RUSHING,
      EVENT_TYPE.CONVERSION_1PT,
    ]);
    expect(events.map((e) => e.half)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(calculatePlayerStats(events, player.id)).toMatchObject({
      rushingTouchdowns: 2,
      onePointConversions: 2,
    });
  });

  it('Pick 6 in Halbzeit 1 -> Halbzeit -> Pick 6 in Halbzeit 2: beide Pick-6-Events behalten ihre korrekte Halbzeit', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });

    renderAt(`/spiele/${game.id}`);

    const pick6 = await screen.findAllByRole('button', { name: 'Pick 6' });
    await user.click(pick6[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Halbzeit' }));
    await findWhatsAppMessage('Halbzeit');
    await user.click(await screen.findByRole('button', { name: "Weiter geht's" }));
    await screen.findByText('2. Halbzeit');

    const pick6H2 = await screen.findAllByRole('button', { name: 'Pick 6' });
    await user.click(pick6H2[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: '#23 Max Muster' }));
    await user.click(await screen.findByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByText('12 : 0')).toBeInTheDocument();

    const events = (await db.events.toArray()).sort((a, b) => a.sequence - b.sequence);
    expect(events).toHaveLength(4);
    const pick6Events = events.filter((e) => e.type === EVENT_TYPE.PICK_6);
    expect(pick6Events).toHaveLength(2);
    expect(pick6Events[0]?.half).toBe(1);
    expect(pick6Events[1]?.half).toBe(2);
  });
});

describe('GameDetailPage – Spiel löschen', () => {
  it('löscht ein Spiel nach Bestätigung und navigiert zur Spieleliste', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Spiel löschen' }));

    expect(await screen.findByRole('heading', { name: /^spiele$/i })).toBeInTheDocument();
    expect(await db.games.get(game.id)).toBeUndefined();
  });

  it('löscht beim Löschen eines Spiels auch dessen Events', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: 'player-1',
      points: 0,
      half: HALF.FIRST,
    });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Spiel löschen' }));
    await screen.findByRole('heading', { name: /^spiele$/i });

    expect(await db.events.where('gameId').equals(game.id).count()).toBe(0);
  });

  it('löscht ein Spiel NICHT, wenn die Bestätigung abgelehnt wird', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await user.click(await screen.findByRole('button', { name: 'Spiel löschen' }));

    expect(await db.games.get(game.id)).toBeDefined();
  });
});

describe('GameDetailPage – Liveticker (PRD §36/§39)', () => {
  it('"Letzte Events" zeigt maximal die letzten 3 Einträge, neueste zuerst', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.INTERCEPTION,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      points: 6,
      half: HALF.FIRST,
    });

    renderAt(`/spiele/${game.id}`);
    // Auf einen tatsächlichen Ticker-Eintrag warten (hängt von der Events-
    // `useLiveQuery` ab) statt nur auf die statische Überschrift
    // "Letzte Events", die bereits vor dem Laden der Events gerendert wird –
    // vermeidet einen seltenen, aber echten Timing-Flake unter Last.
    await screen.findByText('Touchdown Munich Cowboys');

    // Nur die letzten 3 (Sack/Interception/Touchdown), First Down (ältestes) fehlt.
    expect(screen.queryByText('First Down Regensburg Phoenix')).not.toBeInTheDocument();
    const titles = screen.getAllByText(/^(Sack|Interception|Touchdown) Munich Cowboys$/);
    expect(titles.map((el) => el.textContent)).toEqual([
      'Touchdown Munich Cowboys',
      'Interception Munich Cowboys',
      'Sack Munich Cowboys',
    ]);
  });

  it('zeigt nach Klick auf "Vollständigen Liveticker anzeigen" alle Events chronologisch (älteste zuerst)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });

    const user = userEvent.setup();
    renderAt(`/spiele/${game.id}`);
    await user.click(
      await screen.findByRole('button', { name: 'Vollständigen Liveticker anzeigen' }),
    );

    await screen.findByRole('heading', { name: 'Liveticker' });
    const fullTitles = screen.getAllByText('Sack Munich Cowboys');
    // Ein Eintrag in "Letzte Events" + ein Eintrag im vollständigen Liveticker.
    expect(fullTitles).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Liveticker ausblenden' })).toBeInTheDocument();
  });

  it('zeigt alle vier Steuerungs-Events mit eigener, WhatsApp-unabhängiger Darstellung', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent(buildHalftimeEvent({ gameId: game.id, half: HALF.FIRST }));
    await createEvent(buildSecondHalfStartEvent({ gameId: game.id, half: HALF.SECOND }));
    await createEvent(buildTwoMinuteWarningEvent({ gameId: game.id, half: HALF.SECOND }));
    await createEvent(buildGameEndEvent({ gameId: game.id, half: HALF.SECOND }));
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    const user = userEvent.setup();
    renderAt(`/spiele/${game.id}`);
    // Bei FINAL ersetzt die Tab-Struktur (PRD §37) den bisherigen
    // "Vollständigen Liveticker anzeigen"-Umschalter des Live-Screens.
    await user.click(await screen.findByRole('tab', { name: 'Liveticker' }));

    for (const title of ['Halbzeit', "Weiter geht's", '2-Minuten-Warnung', 'Spielende']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
    // Score-Zeile im eigenen Ticker-Format, NICHT im WhatsApp-Format ("Spielstand:"/"Endstand:").
    expect(screen.getAllByText('Regensburg Phoenix 0:0 Munich Cowboys').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Spielstand:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Endstand:/)).not.toBeInTheDocument();
  });

  it('bietet für Steuerungs-Events auch bei FINAL keine Bearbeiten-/Löschen-Buttons an', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent(buildHalftimeEvent({ gameId: game.id, half: HALF.FIRST }));
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await screen.findByText('Halbzeit');

    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
  });
});

describe('GameDetailPage – Event bearbeiten/löschen (PRD §41/§42)', () => {
  it('Bearbeiten-/Löschen-Buttons sind im BEARBEITEN-Tab bei FINAL sichtbar', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    expect(await screen.findByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
  });

  it.each([GAME_STATUS.LIVE_FIRST_HALF, GAME_STATUS.HALFTIME, GAME_STATUS.LIVE_SECOND_HALF])(
    'zeigt während %s keine Bearbeiten-/Löschen-Buttons',
    async (status) => {
      const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
      const player = await createPlayer({
        firstName: 'Max',
        lastName: 'Mustermann',
        jerseyNumber: 12,
      });
      await createEvent({
        gameId: game.id,
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: player.id,
        points: 6,
        half: HALF.FIRST,
      });
      await setGameStatus(game.id, status);

      renderAt(`/spiele/${game.id}`);
      await screen.findByText('Touchdown Regensburg Phoenix');
      expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    },
  );

  it('Rushing-TD: Spieler ändern aktualisiert das Event, Punkte/Typ/Team/Halbzeit bleiben gleich', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const playerA = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const playerB = await createPlayer({
      firstName: 'Peter',
      lastName: 'Beispiel',
      jerseyNumber: 7,
    });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: playerA.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    await user.click(await screen.findByRole('button', { name: 'Ändern' }));
    await user.click(await screen.findByRole('button', { name: '#7 Peter Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    await screen.findByText('#7 Peter Beispiel', { selector: 'p' });
    const stored = await db.events.get(created.id);
    expect(stored?.playerId).toBe(playerB.id);
    expect(stored?.type).toBe(EVENT_TYPE.TOUCHDOWN_RUSHING);
    expect(stored?.team).toBe(TEAM.PHOENIX);
    expect(stored?.half).toBe(HALF.FIRST);
    expect(stored?.points).toBe(6);
  });

  it('Passing TD: QB ändern (Receiver bleibt gleich), aktueller Receiver ist bei der QB-Auswahl ausgeschlossen', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const qb = await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    const receiver = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const newQb = await createPlayer({ firstName: 'Hans', lastName: 'Beispiel', jerseyNumber: 44 });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: qb.id,
      receiverId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    const changeButtons = await screen.findAllByRole('button', { name: 'Ändern' });
    await user.click(changeButtons[0] as HTMLElement); // QB-Feld (erste SummaryField).

    // Der aktuelle Receiver darf nicht gleichzeitig als QB wählbar sein.
    expect(screen.queryByRole('button', { name: '#12 Max Mustermann' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#44 Hans Beispiel' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '#44 Hans Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    const stored = await db.events.get(created.id);
    expect(stored?.qbId).toBe(newQb.id);
    expect(stored?.receiverId).toBe(receiver.id);
    expect(stored?.type).toBe(EVENT_TYPE.TOUCHDOWN_PASSING);
    expect(stored?.team).toBe(TEAM.PHOENIX);
    expect(stored?.half).toBe(HALF.FIRST);
    expect(stored?.points).toBe(6);
  });

  it('Passing TD: Receiver ändern (QB bleibt gleich), aktueller QB ist bei der Receiver-Auswahl ausgeschlossen', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const qb = await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    const receiver = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const newReceiver = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: qb.id,
      receiverId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    const changeButtons = await screen.findAllByRole('button', { name: 'Ändern' });
    await user.click(changeButtons[1] as HTMLElement); // Receiver-Feld (zweite SummaryField).

    // Der aktuelle QB darf nicht gleichzeitig als Receiver wählbar sein.
    expect(screen.queryByRole('button', { name: '#7 Peter Beispiel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#44 Hans Beispiel' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '#44 Hans Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    const stored = await db.events.get(created.id);
    expect(stored?.qbId).toBe(qb.id);
    expect(stored?.receiverId).toBe(newReceiver.id);
    expect(stored?.points).toBe(6);
  });

  it('Conversion: Erfolg -> Fehlgeschlagen entfernt den Spieler und setzt Punkte auf 0', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.PHOENIX,
      playerId: player.id,
      successful: true,
      points: 1,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('1 : 0')).toBeInTheDocument();
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    const changeButtons = await screen.findAllByRole('button', { name: 'Ändern' });
    await user.click(changeButtons[0] as HTMLElement); // Ergebnis-Feld.
    await user.click(await screen.findByRole('button', { name: 'Fehlgeschlagen' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    const stored = await db.events.get(created.id);
    expect(stored?.successful).toBe(false);
    expect(stored?.playerId).toBeNull();
    expect(stored?.points).toBe(0);
    const events = await db.events.toArray();
    expect(calculatePlayerStats(events, player.id).onePointConversions).toBe(0);
  });

  it('Conversion: Fehlgeschlagen -> Erfolg verlangt einen Spieler und speichert Punkte korrekt', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.CONVERSION_2PT,
      team: TEAM.PHOENIX,
      successful: false,
      points: 0,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    await user.click(await screen.findByRole('button', { name: 'Ändern' })); // nur ein Feld (Ergebnis) sichtbar.
    await user.click(await screen.findByRole('button', { name: 'Erfolgreich' }));
    // Erfolgreiche eigene Conversion verlangt sofort einen Spieler (wie bei der Neuanlage).
    await user.click(await screen.findByRole('button', { name: '#12 Max Mustermann' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('2 : 0')).toBeInTheDocument();
    const stored = await db.events.get(created.id);
    expect(stored?.successful).toBe(true);
    expect(stored?.playerId).toBe(player.id);
    expect(stored?.points).toBe(2);
    const events = await db.events.toArray();
    expect(calculatePlayerStats(events, player.id).twoPointConversions).toBe(1);
  });

  it('Event löschen entfernt es dauerhaft und berechnet Score/Statistik neu', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    const pick6 = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.PICK_6,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('12 : 0')).toBeInTheDocument();
    await openTab(user, 'Bearbeiten');
    // BEARBEITEN zeigt den vollständigen Liveticker chronologisch (ältestes
    // zuerst) – Pick 6 ist der zweite Eintrag, gezielt über seinen
    // Listeneintrag gesucht statt über eine Positionsannahme.
    const pick6Item = (await screen.findByText('Pick 6 Regensburg Phoenix')).closest('li');
    if (!pick6Item) {
      throw new Error('Pick-6-Ticker-Eintrag nicht gefunden.');
    }
    await user.click(within(pick6Item).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
    expect(await db.events.get(pick6.id)).toBeUndefined();
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(calculatePlayerStats(events, player.id)).toMatchObject({
      rushingTouchdowns: 1,
      pickSixes: 0,
    });
    expect(screen.queryByTestId('whatsapp-message')).not.toBeInTheDocument();
  });

  it('Bearbeiten erzeugt KEINE neue WhatsApp-Nachricht (PRD §42)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    const secondPlayer = await createPlayer({
      firstName: 'Peter',
      lastName: 'Beispiel',
      jerseyNumber: 7,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    await user.click(await screen.findByRole('button', { name: 'Ändern' }));
    await user.click(await screen.findByRole('button', { name: '#7 Peter Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));

    await screen.findByText('#7 Peter Beispiel', { selector: 'p' });
    const events = await db.events.toArray();
    expect(events[0]?.playerId).toBe(secondPlayer.id);
    expect(screen.queryByText('WhatsApp-Text (manuell einfügen)')).not.toBeInTheDocument();
    expect(screen.queryByTestId('whatsapp-message')).not.toBeInTheDocument();
  });

  it('bleibt nach einem Reload als bearbeitetes Event erhalten', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const playerA = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const playerB = await createPlayer({
      firstName: 'Peter',
      lastName: 'Beispiel',
      jerseyNumber: 7,
    });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: playerA.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    const first = renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    await user.click(await screen.findByRole('button', { name: 'Ändern' }));
    await user.click(await screen.findByRole('button', { name: '#7 Peter Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));
    await screen.findByText('#7 Peter Beispiel', { selector: 'p' });
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    await screen.findByText('#7 Peter Beispiel', { selector: 'p' });
    const stored = await db.events.get(created.id);
    expect(stored?.playerId).toBe(playerB.id);
  });

  it('bleibt nach einem Reload als gelöscht (Event fehlt) erhalten', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const created = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const first = renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Löschen' }));
    await screen.findByText('0 : 0');
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('0 : 0')).toBeInTheDocument();
    expect(await db.events.get(created.id)).toBeUndefined();
  });

  it('erzeugt bei zwei wirklich überlappenden Klicks auf "Löschen" nur eine einzige Löschung', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderAt(`/spiele/${game.id}`);
    fireEvent.click(await screen.findByRole('tab', { name: 'Bearbeiten' }));
    const deleteButton = await screen.findByRole('button', { name: 'Löschen' });
    // `fireEvent.click` (synchron, ohne auf den ersten Klick zu warten)
    // simuliert zwei echt überlappende Klicks, im Unterschied zu
    // `userEvent.dblClick`, das intern den ersten Klick vollständig
    // abwartet, bevor der zweite ausgelöst wird (siehe 2-Minuten-Test oben).
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    await screen.findByText('0 : 0');
    // Ein synchroner Ref-Guard (siehe `GameDetailPage.tsx`) verhindert, dass
    // ein zweiter, überlappender Klick überhaupt einen zweiten
    // Bestätigungsdialog auslöst.
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });
});

describe('GameDetailPage – Tab-Struktur (PRD §37)', () => {
  it('zeigt bei FINAL alle vier Tabs in der korrekten PRD-Reihenfolge', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Übersicht',
      'Liveticker',
      'Statistiken',
      'Bearbeiten',
    ]);
  });

  it('zeigt beim ersten Laden ÜBERSICHT als aktiven Standard-Tab', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    const overview = await screen.findByRole('tab', { name: 'Übersicht' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Letzte Events' })).toBeInTheDocument();
  });

  it('wechselt zwischen allen vier Tabs und zeigt den jeweils aktiven Tab eindeutig an', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await screen.findByRole('heading', { name: 'Letzte Events' });

    await openTab(user, 'Liveticker');
    expect(await screen.findByRole('tab', { name: 'Liveticker' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(await screen.findByRole('heading', { name: 'Liveticker' })).toBeInTheDocument();
    // Liveticker ist rein lesend – kein Bearbeiten/Löschen hier.
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();

    await openTab(user, 'Statistiken');
    expect(await screen.findByRole('tab', { name: 'Statistiken' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('#12 Max Mustermann')).toBeInTheDocument();

    await openTab(user, 'Bearbeiten');
    expect(await screen.findByRole('tab', { name: 'Bearbeiten' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('button', { name: 'Löschen' })).toBeInTheDocument();
  });

  it('zeigt bei einem laufenden Spiel weiterhin den Live-Spielbildschirm ohne Tab-Struktur (keine Regression)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });

    renderAt(`/spiele/${game.id}`);
    await screen.findByText('1. Halbzeit');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: 'Touchdown' })).toHaveLength(2);
  });

  it('zeigt nach einem Reload wieder ÜBERSICHT als Standardansicht', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    const first = renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');
    expect(await screen.findByRole('tab', { name: 'Statistiken' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByRole('tab', { name: 'Übersicht' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('GameDetailPage – Übersicht-Tab (PRD §38)', () => {
  it('zeigt Gegner, Datum, Status und aus den Events abgeleiteten Spielstand', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: 'seed-player',
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByText('Munich Cowboys')).toBeInTheDocument();
    expect(screen.getByText('12.09.2026')).toBeInTheDocument();
    expect(screen.getByText('Regensburg Phoenix')).toBeInTheDocument();
    expect(screen.getByText('Beendet')).toBeInTheDocument();
    // Der Score hängt von einer eigenen, unabhängigen `useLiveQuery` (Events)
    // ab, die zeitlich NICHT zwangsläufig zusammen mit der Spiel-Query
    // auflöst, die "Munich Cowboys" oben bereits abgewartet hat – daher hier
    // ebenfalls `findByText` statt `getByText` (vermeidet einen seltenen,
    // aber echten Timing-Flake unter Last).
    expect(await screen.findByText('6 : 0')).toBeInTheDocument();
  });

  it('bindet "Letzte Events" gemäß §36 im ÜBERSICHT-Tab ein (dieselbe Ticker-Darstellung)', async () => {
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    expect(await screen.findByRole('heading', { name: 'Letzte Events' })).toBeInTheDocument();
    expect(await screen.findByText('Sack Munich Cowboys')).toBeInTheDocument();
    // Übersicht ist schreibgeschützt – Bearbeiten/Löschen gehört zum eigenen Tab.
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
  });
});

describe('GameDetailPage – Statistiken-Tab (PRD §40)', () => {
  it('zeigt die §40-Statistikzeilen für einen teilnehmenden Spieler inkl. Nullwerten', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.PHOENIX,
      playerId: player.id,
      successful: true,
      points: 1,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');

    expect(await screen.findByText('#12 Max Mustermann')).toBeInTheDocument();
    expect(screen.getByText('Rushing TD')).toBeInTheDocument();
    expect(screen.getByText('1 Pt Conversions')).toBeInTheDocument();
    // Nullwerte werden gemäß PRD NICHT ausgeblendet (§40 zeigt sie im Beispiel).
    expect(screen.getByText('Sacks')).toBeInTheDocument();
    // "Interceptions" existiert seit der Team-Gesamtstatistik-Erweiterung
    // zusätzlich als Team-Statistik-Zeile – hier reicht der Nachweis, dass
    // die Zeile (mindestens einmal) vorhanden ist.
    expect(screen.getAllByText('Interceptions').length).toBeGreaterThan(0);
  });

  it('zeigt Passing TD und Receiving TD getrennt für QB und Receiver eines Passing-TD-Events', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const qb = await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    const receiver = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: qb.id,
      receiverId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');

    expect(await screen.findByText('#7 Peter Beispiel')).toBeInTheDocument();
    expect(screen.getByText('#12 Max Mustermann')).toBeInTheDocument();
    // "Passing TD" ist eine Zeile in JEDEM Spielerblock (auch mit Wert 0) -
    // hier zählt, dass beide Blöcke sie enthalten.
    expect(screen.getAllByText('Passing TD')).toHaveLength(2);
  });

  it('zeigt nur Spieler, die tatsächlich in diesem Spiel vorkommen', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const participant = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: participant.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');

    expect(await screen.findByText('#12 Max Mustermann')).toBeInTheDocument();
    expect(screen.queryByText('#7 Peter Beispiel')).not.toBeInTheDocument();
  });

  it('berücksichtigt einen inzwischen deaktivierten Spieler, der im Spiel vorkam (PRD §9.2)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);
    await updatePlayer(player.id, { active: false });

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');

    expect(await screen.findByText('#12 Max Mustermann')).toBeInTheDocument();
  });

  it('zeigt "Noch keine Spielerstatistiken vorhanden.", wenn nur Steuerungs-Events existieren (keine Control-Events in Spielerstatistiken)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    await createEvent(buildHalftimeEvent({ gameId: game.id, half: HALF.FIRST }));
    await createEvent(buildSecondHalfStartEvent({ gameId: game.id, half: HALF.SECOND }));
    await createEvent(buildGameEndEvent({ gameId: game.id, half: HALF.SECOND }));
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');

    expect(await screen.findByText('Noch keine Spielerstatistiken vorhanden.')).toBeInTheDocument();
  });

  it('aktualisiert die Statistik automatisch nach dem Bearbeiten eines Events', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const playerA = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    const playerB = await createPlayer({
      firstName: 'Peter',
      lastName: 'Beispiel',
      jerseyNumber: 7,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: playerA.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    await user.click(await screen.findByRole('button', { name: 'Ändern' }));
    await user.click(await screen.findByRole('button', { name: '#7 Peter Beispiel' }));
    await user.click(await screen.findByRole('button', { name: 'Speichern' }));
    await screen.findByText('#7 Peter Beispiel', { selector: 'p' });

    await openTab(user, 'Statistiken');
    expect(await screen.findByText('#7 Peter Beispiel')).toBeInTheDocument();
    expect(screen.queryByText('#12 Max Mustermann')).not.toBeInTheDocument();
    const events = await db.events.toArray();
    expect(events[0]?.playerId).toBe(playerB.id);
  });

  it('aktualisiert die Statistik automatisch nach dem Löschen eines Events', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Löschen' }));
    await screen.findByText('0 : 0');

    await openTab(user, 'Statistiken');
    expect(await screen.findByText('Noch keine Spielerstatistiken vorhanden.')).toBeInTheDocument();
  });

  it('bleibt nach einem Reload korrekt (Statistik aus den persistierten Events)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    const first = renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');
    await screen.findByText('#12 Max Mustermann');
    first.unmount();

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');
    expect(await screen.findByText('#12 Max Mustermann')).toBeInTheDocument();
    expect(screen.getByText('Rushing TD')).toBeInTheDocument();
  });

  it('zeigt die Teamstatistik mit korrekten Werten für beide Teams (Turnover on Downs: NEGATIVE Statistik für das Team, das den Ball verliert)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 6,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.INTERCEPTION,
      team: TEAM.PHOENIX,
      playerId: player.id,
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      points: 6,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.OPPONENT,
      points: 0,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');

    // "Regensburg Phoenix" erscheint auch im gemeinsamen Kopfbereich
    // (Scoreboard) – daher zuerst auf den Teamstatistik-Abschnitt scopen,
    // bevor die einzelnen Team-Karten darin gesucht werden.
    const teamStatsHeading = await screen.findByText('Teamstatistik');
    const teamStatsSection = teamStatsHeading.closest('div');
    if (!teamStatsSection) {
      throw new Error('Teamstatistik-Abschnitt nicht gefunden.');
    }
    const phoenixCard = within(teamStatsSection).getByText('Regensburg Phoenix').closest('div');
    const opponentCard = within(teamStatsSection).getByText('Munich Cowboys').closest('div');
    if (!phoenixCard || !opponentCard) {
      throw new Error('Team-Statistik-Karten nicht gefunden.');
    }
    expect(within(phoenixCard).getByText('Touchdowns').closest('div')).toHaveTextContent('1');
    expect(within(phoenixCard).getByText('Interceptions').closest('div')).toHaveTextContent('1');
    expect(within(opponentCard).getByText('Touchdowns').closest('div')).toHaveTextContent('1');
    expect(within(opponentCard).getByText('Turnover on Downs').closest('div')).toHaveTextContent(
      '1',
    );
  });

  it('berechnet die Teamstatistik nach dem Löschen eines Events korrekt neu (Löschen reduziert den Wert des verlierenden Teams)', async () => {
    const user = userEvent.setup();
    const game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
    // team: TEAM.PHOENIX bedeutet hier: die eigene Offense verliert den Ball
    // bei Downs (NEGATIVE Statistik) – siehe `domain/turnoverOnDowns.ts`.
    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TURNOVER_ON_DOWNS,
      team: TEAM.PHOENIX,
      points: 0,
      half: HALF.FIRST,
    });
    await setGameStatus(game.id, GAME_STATUS.FINAL);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderAt(`/spiele/${game.id}`);
    await openTab(user, 'Statistiken');
    // "Regensburg Phoenix" erscheint auch im gemeinsamen Kopfbereich
    // (Scoreboard) – daher zuerst auf den Teamstatistik-Abschnitt scopen.
    const teamStatsHeadingBefore = await screen.findByText('Teamstatistik');
    const teamStatsSectionBefore = teamStatsHeadingBefore.closest('div');
    if (!teamStatsSectionBefore) {
      throw new Error('Teamstatistik-Abschnitt nicht gefunden.');
    }
    const phoenixCardBefore = within(teamStatsSectionBefore)
      .getByText('Regensburg Phoenix')
      .closest('div');
    if (!phoenixCardBefore) {
      throw new Error('Team-Statistik-Karte nicht gefunden.');
    }
    expect(
      within(phoenixCardBefore).getByText('Turnover on Downs').closest('div'),
    ).toHaveTextContent('1');

    await openTab(user, 'Bearbeiten');
    await user.click(await screen.findByRole('button', { name: 'Löschen' }));
    await screen.findByText('0 : 0');

    await openTab(user, 'Statistiken');
    const teamStatsHeadingAfter = await screen.findByText('Teamstatistik');
    const teamStatsSectionAfter = teamStatsHeadingAfter.closest('div');
    if (!teamStatsSectionAfter) {
      throw new Error('Teamstatistik-Abschnitt nicht gefunden.');
    }
    const phoenixCardAfter = within(teamStatsSectionAfter)
      .getByText('Regensburg Phoenix')
      .closest('div');
    if (!phoenixCardAfter) {
      throw new Error('Team-Statistik-Karte nicht gefunden.');
    }
    expect(
      within(phoenixCardAfter).getByText('Turnover on Downs').closest('div'),
    ).toHaveTextContent('0');
  });
});
