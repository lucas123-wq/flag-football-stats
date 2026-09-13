import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createEvent, listEventsByGame } from '../../data/events';
import { getPlayer, listActivePlayers } from '../../data/players';
import { calculateScore } from '../../domain/scoring';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import { buildPickEvent, formatPickMessage } from '../../domain/pick';
import { formatPlayerLabel } from '../../domain/touchdown';
import { TEAM } from '../../domain/types';
import type { PickVariant } from '../../domain/pick';
import type { Game, Player, Team } from '../../domain/types';
import { ConfirmView, FlowOverlay, PlayerPicker } from './EventFlowUI';
import { useActionGuard } from './useActionGuard';

// Wie bei den anderen Flows: der ausgewählte Spieler wird als vollständiges
// Objekt im Zustand gehalten; die Existenzprüfung vor dem Speichern erfolgt
// zusätzlich frisch über `getPlayer`.
type PickStep = { kind: 'select-scorer' } | { kind: 'confirm'; scorer?: Player };

interface PickFlowProps {
  game: Game;
  /** Legt fest, ob der eigene oder der gegnerische Pick-6-/Pick-2-Flow läuft. */
  team: Team;
  variant: PickVariant;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

const PICK_LABEL: Record<PickVariant, string> = { SIX: 'Pick 6', TWO: 'Pick 2' };

/**
 * Auswahl- und Bestätigungs-Flow für Pick 6/Pick 2 (PRD §22/§23).
 *
 * WICHTIG: Pick 6/Pick 2 sind EIGENSTÄNDIGE Events – dieser Flow erzeugt
 * niemals zusätzlich ein `INTERCEPTION`-Event (siehe `InterceptionFlow.tsx`
 * für die separate normale Interception). Keine Rushing/Passing-Auswahl.
 * Läuft vollständig als lokaler React-Zustand (kein eigenes Routing). Vor
 * "Bestätigen" wird nichts gespeichert.
 */
export function PickFlow({ game, team, variant, onCancel, onSaved }: PickFlowProps) {
  const activePlayers = useLiveQuery(() => listActivePlayers(), []) ?? [];
  const [step, setStep] = useState<PickStep>(
    team === TEAM.OPPONENT ? { kind: 'confirm' } : { kind: 'select-scorer' },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchroner Guard gegen echte überlappende Doppelklicks auf "Bestätigen"
  // (siehe `useActionGuard`) – zusätzlich zu `isSaving`.
  const actionGuard = useActionGuard();

  const label = PICK_LABEL[variant];
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
          buildPickEvent({ gameId: game.id, half, variant, team, scorerId: scorer?.id }),
        );
        const scoreAfter = calculateScore(await listEventsByGame(game.id));
        onSaved(
          formatPickMessage({
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
          prompt={`Welcher Spieler hat den ${label} erzielt?`}
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
