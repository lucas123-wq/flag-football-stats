import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createEvent } from '../../data/events';
import { getPlayer, listActivePlayers } from '../../data/players';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import { buildInterceptionEvent, formatInterceptionMessage } from '../../domain/interception';
import { formatPlayerLabel } from '../../domain/touchdown';
import { TEAM } from '../../domain/types';
import type { Game, Player, Team } from '../../domain/types';
import { ConfirmView, FlowOverlay, PlayerPicker } from './EventFlowUI';
import { useActionGuard } from './useActionGuard';

// Wie bei `FirstDownFlow`: der ausgewählte Spieler wird als vollständiges
// Objekt im Zustand gehalten; die Existenzprüfung vor dem Speichern erfolgt
// zusätzlich frisch über `getPlayer`.
type InterceptionStep = { kind: 'select-scorer' } | { kind: 'confirm'; scorer?: Player };

interface InterceptionFlowProps {
  game: Game;
  /** Legt fest, ob der eigene oder der gegnerische Interception-Flow läuft. */
  team: Team;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

/**
 * Auswahl- und Bestätigungs-Flow für eine Interception (PRD §21). Wie First
 * Down keine Rushing/Passing-Unterscheidung – bei eigenem Team wird direkt
 * der fangende Spieler gewählt, beim Gegner entfällt die Spielerauswahl.
 * Läuft vollständig als lokaler React-Zustand (kein eigenes Routing). Vor
 * "Bestätigen" wird nichts gespeichert. Erzeugt NIEMALS zusätzlich ein
 * Pick-6-/Pick-2-Event (siehe `PickFlow.tsx` für diese eigenständigen
 * Events).
 */
export function InterceptionFlow({ game, team, onCancel, onSaved }: InterceptionFlowProps) {
  const activePlayers = useLiveQuery(() => listActivePlayers(), []) ?? [];
  const [step, setStep] = useState<InterceptionStep>(
    team === TEAM.OPPONENT ? { kind: 'confirm' } : { kind: 'select-scorer' },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchroner Guard gegen echte überlappende Doppelklicks auf "Bestätigen"
  // (siehe `useActionGuard`) – zusätzlich zu `isSaving`.
  const actionGuard = useActionGuard();

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
          buildInterceptionEvent({ gameId: game.id, half, team, scorerId: scorer?.id }),
        );
        // Kein Score-Neuberechnen nötig: Interception ändert den Score nie
        // und die Nachricht enthält deshalb bewusst keine Spielstand-Zeile.
        onSaved(
          formatInterceptionMessage({
            team,
            opponentName: game.opponent,
            scorerLabel: scorer ? formatPlayerLabel(scorer) : undefined,
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
    <FlowOverlay title="Interception" onCancel={onCancel} error={error}>
      {step.kind === 'select-scorer' && (
        <PlayerPicker
          prompt="Welcher Spieler hat die Interception gefangen?"
          players={activePlayers}
          onSelect={selectScorer}
        />
      )}

      {step.kind === 'confirm' && (
        <ConfirmView
          lines={[
            `Interception ${teamName}`,
            ...(step.scorer ? [formatPlayerLabel(step.scorer)] : []),
          ]}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </FlowOverlay>
  );
}
