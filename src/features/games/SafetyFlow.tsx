import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createEvent, listEventsByGame } from '../../data/events';
import { getPlayer, listActivePlayers } from '../../data/players';
import { calculateScore } from '../../domain/scoring';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import { buildSafetyEvent, formatSafetyMessage } from '../../domain/safety';
import { formatPlayerLabel } from '../../domain/touchdown';
import { TEAM } from '../../domain/types';
import type { SafetyVariant } from '../../domain/safety';
import type { Game, Player, Team } from '../../domain/types';
import { ConfirmView, FlowOverlay, PlayerPicker } from './EventFlowUI';
import { useActionGuard } from './useActionGuard';

// Wie bei den anderen Flows: der ausgewählte Spieler wird als vollständiges
// Objekt im Zustand gehalten; die Existenzprüfung vor dem Speichern erfolgt
// zusätzlich frisch über `getPlayer`.
type SafetyStep = { kind: 'select-scorer' } | { kind: 'confirm'; scorer?: Player };

interface SafetyFlowProps {
  game: Game;
  /** Legt fest, ob der eigene oder der gegnerische Safety-Flow läuft. */
  team: Team;
  variant: SafetyVariant;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

const SAFETY_LABEL: Record<SafetyVariant, string> = { SAFETY: 'Safety', SAFETY_1PT: '1 Pt Safety' };

/**
 * Auswahl- und Bestätigungs-Flow für Safety/1-Punkt-Safety (PRD §25/§26).
 * Keine Rushing/Passing-Auswahl. Der Score wird immer dem Team
 * gutgeschrieben, das die Safety erzielt hat – beim Gegner erfolgt KEINE
 * Spielerauswahl. Läuft vollständig als lokaler React-Zustand (kein eigenes
 * Routing). Vor "Bestätigen" wird nichts gespeichert.
 */
export function SafetyFlow({ game, team, variant, onCancel, onSaved }: SafetyFlowProps) {
  const activePlayers = useLiveQuery(() => listActivePlayers(), []) ?? [];
  const [step, setStep] = useState<SafetyStep>(
    team === TEAM.OPPONENT ? { kind: 'confirm' } : { kind: 'select-scorer' },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchroner Guard gegen echte überlappende Doppelklicks auf "Bestätigen"
  // (siehe `useActionGuard`) – zusätzlich zu `isSaving`.
  const actionGuard = useActionGuard();

  const label = SAFETY_LABEL[variant];
  const teamName = team === TEAM.PHOENIX ? 'Regensburg Phoenix' : game.opponent;

  const selectScorer = (scorer: Player) => {
    setError(null);
    setStep({ kind: 'confirm', scorer });
  };

  const handleConfirm = async () => {
    if (step.kind !== 'confirm') {
      return;
    }
    await actionGuard.run(async () => {
      setError(null);
      setIsSaving(true);
      try {
        let scorer: Player | undefined;
        if (step.scorer) {
          const found = await getPlayer(step.scorer.id);
          if (!found) {
            throw new Error(
              'Der ausgewählte Spieler existiert nicht mehr. Bitte erneut auswählen.',
            );
          }
          scorer = found;
        }

        const half = resolveCurrentHalf(game.status);
        await createEvent(
          buildSafetyEvent({ gameId: game.id, half, variant, team, scorerId: scorer?.id }),
        );
        const scoreAfter = calculateScore(await listEventsByGame(game.id));
        onSaved(
          formatSafetyMessage({
            variant,
            team,
            opponentName: game.opponent,
            scorerLabel: scorer ? formatPlayerLabel(scorer) : undefined,
            scoreAfter,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <FlowOverlay title={label} onCancel={onCancel} error={error}>
      {step.kind === 'select-scorer' && (
        <PlayerPicker
          prompt={`Welcher Spieler hat die ${label} erzielt?`}
          players={activePlayers}
          onSelect={selectScorer}
        />
      )}

      {step.kind === 'confirm' && (
        <ConfirmView
          lines={[`${label} ${teamName}`, ...(step.scorer ? [formatPlayerLabel(step.scorer)] : [])]}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </FlowOverlay>
  );
}
