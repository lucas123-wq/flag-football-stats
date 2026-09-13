import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { GameStatsTab } from './GameStatsTab';
import { EVENT_TYPE, HALF, TEAM } from '../../domain/types';
import type { GameEvent, Player } from '../../domain/types';

let sequence = 0;
function makeEvent(overrides: Partial<GameEvent> & Pick<GameEvent, 'type'>): GameEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    gameId: 'game-1',
    sequence,
    team: null,
    playerId: null,
    qbId: null,
    receiverId: null,
    successful: null,
    points: 0,
    half: HALF.FIRST,
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'jerseyNumber'>): Player {
  return {
    firstName: 'Max',
    lastName: 'Mustermann',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GameStatsTab', () => {
  it('zeigt einen Hinweistext, wenn kein Spieler teilnahm', () => {
    render(<GameStatsTab events={[]} players={[]} opponentName="Munich Cowboys" />);
    expect(screen.getByText('Noch keine Spielerstatistiken vorhanden.')).toBeInTheDocument();
  });

  it('zeigt die Teamstatistik für beide Teams auch ohne jegliche Events (alle Werte 0)', () => {
    render(<GameStatsTab events={[]} players={[]} opponentName="Munich Cowboys" />);

    expect(screen.getByText('Teamstatistik')).toBeInTheDocument();
    const phoenixCard = screen.getByText('Regensburg Phoenix').closest('div');
    const opponentCard = screen.getByText('Munich Cowboys').closest('div');
    if (!phoenixCard || !opponentCard) {
      throw new Error('Team-Statistik-Karten nicht gefunden.');
    }
    for (const card of [phoenixCard, opponentCard]) {
      expect(within(card).getByText('Touchdowns')).toBeInTheDocument();
      expect(within(card).getByText('1-Pt Conversions')).toBeInTheDocument();
      expect(within(card).getByText('2-Pt Conversions')).toBeInTheDocument();
      expect(within(card).getByText('Interceptions')).toBeInTheDocument();
      expect(within(card).getByText('Turnover on Downs')).toBeInTheDocument();
      // Alle Werte 0, aber sichtbar (nicht ausgeblendet).
      expect(within(card).getAllByText('0')).toHaveLength(5);
    }
  });

  it('sortiert teilnehmende Spieler nach Trikotnummer aufsteigend, unabhängig von der Event-Reihenfolge', () => {
    const players = [
      makePlayer({ id: 'p-44', jerseyNumber: 44, firstName: 'Hans', lastName: 'Beispiel' }),
      makePlayer({ id: 'p-7', jerseyNumber: 7, firstName: 'Peter', lastName: 'Beispiel' }),
      makePlayer({ id: 'p-12', jerseyNumber: 12, firstName: 'Max', lastName: 'Mustermann' }),
    ];
    // Events bewusst NICHT in Trikotnummern-Reihenfolge.
    const events = [
      makeEvent({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'p-44' }),
      makeEvent({ type: EVENT_TYPE.FIRST_DOWN, team: TEAM.PHOENIX, playerId: 'p-7' }),
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: 'p-12',
        points: 6,
      }),
    ];

    render(<GameStatsTab events={events} players={players} opponentName="Munich Cowboys" />);
    const headings = screen.getAllByText(/^#\d+ /);
    expect(headings.map((el) => el.textContent)).toEqual([
      '#7 Peter Beispiel',
      '#12 Max Mustermann',
      '#44 Hans Beispiel',
    ]);
  });

  it('zeigt exakt die §40-Statistikzeilen (inkl. der ergänzten Passing-TD-Zeile) für jeden Spieler', () => {
    const player = makePlayer({ id: 'p-12', jerseyNumber: 12 });
    const events = [
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: 'p-12',
        points: 6,
      }),
    ];

    render(<GameStatsTab events={events} players={[player]} opponentName="Munich Cowboys" />);
    // Scoping auf die Spielerkarte: "Interceptions" existiert auch als
    // Teamstatistik-Zeile (eigener Abschnitt) – ein ungescoptes `getByText`
    // wäre daher mehrdeutig.
    const playerCard = screen.getByText('#12 Max Mustermann').closest('div');
    if (!playerCard) {
      throw new Error('Spielerkarte nicht gefunden.');
    }
    const expectedLabels = [
      'Rushing TD',
      'Passing TD',
      'Receiving TD',
      'First Downs',
      '1 Pt Conversions',
      '2 Pt Conversions',
      'Interceptions',
      'Pick 6',
      'Pick 2',
      'Sacks',
      'Safeties',
      '1 Pt Safeties',
    ];
    for (const label of expectedLabels) {
      expect(within(playerCard).getByText(label)).toBeInTheDocument();
    }
  });

  it('ignoriert Spieler, die dem Datensatz nicht (mehr) angehören (defensiv, sollte praktisch nie eintreten)', () => {
    const events = [
      makeEvent({ type: EVENT_TYPE.SACK, team: TEAM.PHOENIX, playerId: 'unbekannt' }),
    ];
    render(<GameStatsTab events={events} players={[]} opponentName="Munich Cowboys" />);
    expect(screen.getByText('Noch keine Spielerstatistiken vorhanden.')).toBeInTheDocument();
  });

  it('zeigt für einen Spieler die aus calculatePlayerStats abgeleiteten Werte korrekt an', () => {
    const player = makePlayer({ id: 'p-12', jerseyNumber: 12 });
    const events = [
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: 'p-12',
        points: 6,
      }),
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: 'p-12',
        points: 6,
      }),
      makeEvent({
        type: EVENT_TYPE.CONVERSION_1PT,
        team: TEAM.PHOENIX,
        playerId: 'p-12',
        successful: true,
        points: 1,
      }),
    ];

    render(<GameStatsTab events={events} players={[player]} opponentName="Munich Cowboys" />);
    const rushingRow = screen.getByText('Rushing TD').closest('div');
    expect(rushingRow).toHaveTextContent('2');
    const conversionRow = screen.getByText('1 Pt Conversions').closest('div');
    expect(conversionRow).toHaveTextContent('1');
  });

  it('zeigt die aus calculateTeamStats abgeleiteten Werte korrekt getrennt je Team an (Turnover on Downs: team = das Team, das den Ball verliert)', () => {
    const events = [
      makeEvent({
        type: EVENT_TYPE.TOUCHDOWN_RUSHING,
        team: TEAM.PHOENIX,
        playerId: 'p-12',
        points: 6,
      }),
      makeEvent({ type: EVENT_TYPE.TOUCHDOWN_OPPONENT, team: TEAM.OPPONENT, points: 6 }),
      makeEvent({ type: EVENT_TYPE.INTERCEPTION, team: TEAM.PHOENIX, playerId: 'p-12' }),
      makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT }),
      makeEvent({ type: EVENT_TYPE.TURNOVER_ON_DOWNS, team: TEAM.OPPONENT }),
    ];

    render(<GameStatsTab events={events} players={[]} opponentName="Munich Cowboys" />);

    const phoenixCard = screen.getByText('Regensburg Phoenix').closest('div');
    const opponentCard = screen.getByText('Munich Cowboys').closest('div');
    if (!phoenixCard || !opponentCard) {
      throw new Error('Team-Statistik-Karten nicht gefunden.');
    }
    expect(within(phoenixCard).getByText('Touchdowns').closest('div')).toHaveTextContent('1');
    expect(within(phoenixCard).getByText('Interceptions').closest('div')).toHaveTextContent('1');
    expect(within(phoenixCard).getByText('Turnover on Downs').closest('div')).toHaveTextContent(
      '0',
    );

    expect(within(opponentCard).getByText('Touchdowns').closest('div')).toHaveTextContent('1');
    expect(within(opponentCard).getByText('Turnover on Downs').closest('div')).toHaveTextContent(
      '2',
    );
  });
});
