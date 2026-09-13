import { useState } from 'react';
import { createEvent } from '../../data/events';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import {
  buildTurnoverOnDownsEvent,
  formatTurnoverOnDownsMessage,
} from '../../domain/turnoverOnDowns';
import { TEAM } from '../../domain/types';
import type { Game, Team } from '../../domain/types';
import { ConfirmView, FlowOverlay } from './EventFlowUI';
import { useActionGuard } from './useActionGuard';

interface TurnoverOnDownsFlowProps {
  game: Game;
  /**
   * Das Team, dessen Offense den Ball durch den Turnover on Downs verliert
   * (NEGATIVE Statistik – siehe `domain/turnoverOnDowns.ts`) – ausgelöst über
   * den Button in dessen eigenem Bereich (Eigene Mannschaft/Gegner).
   */
  team: Team;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

/**
 * Bestätigungs-Flow für Turnover on Downs. Anders als bei First
 * Down/Interception/Sack wird HIER nie ein Spieler erfasst – für kein Team
 * ("kein Spieler wird ausgewählt") – daher gibt es keinen Auswahlschritt,
 * nur direkt die Bestätigungsseite (analog zu den anderen Flows im
 * Gegner-Fall, hier aber für BEIDE Teams). Läuft vollständig als lokaler
 * React-Zustand (kein eigenes Routing). Vor "Bestätigen" wird nichts
 * gespeichert.
 */
export function TurnoverOnDownsFlow({ game, team, onCancel, onSaved }: TurnoverOnDownsFlowProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchroner Guard gegen echte überlappende Doppelklicks auf "Bestätigen"
  // (siehe `useActionGuard`) – zusätzlich zu `isSaving`.
  const actionGuard = useActionGuard();

  const teamName = team === TEAM.PHOENIX ? 'Regensburg Phoenix' : game.opponent;

  const handleConfirm = async () => {
    await actionGuard.run(async () => {
      setError(null);
      setIsSaving(true);
      try {
        const half = resolveCurrentHalf(game.status);
        await createEvent(buildTurnoverOnDownsEvent({ gameId: game.id, half, team }));
        // Kein Score-Neuberechnen nötig: Turnover on Downs ändert den Score
        // nie und die Nachricht enthält deshalb bewusst keine Spielstand-Zeile.
        onSaved(formatTurnoverOnDownsMessage({ team, opponentName: game.opponent }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <FlowOverlay title="Turnover on Downs" onCancel={onCancel} error={error}>
      <ConfirmView
        lines={[`Turnover on Downs ${teamName}`]}
        isSaving={isSaving}
        onConfirm={handleConfirm}
        onCancel={onCancel}
      />
    </FlowOverlay>
  );
}
