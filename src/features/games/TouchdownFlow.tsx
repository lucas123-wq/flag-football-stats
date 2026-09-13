import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createEvent, listEventsByGame } from '../../data/events';
import { getPlayer, listActivePlayers } from '../../data/players';
import { calculateScore } from '../../domain/scoring';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import {
  buildOpponentTouchdownEvent,
  buildPassingTouchdownEvent,
  buildRushingTouchdownEvent,
  formatPlayerLabel,
  formatTouchdownMessage,
} from '../../domain/touchdown';
import { TEAM } from '../../domain/types';
import type { Game, Player, Team } from '../../domain/types';
import type { TouchdownVariant } from '../../domain/touchdown';
import { ConfirmView, FlowOverlay, PlayerPicker } from './EventFlowUI';
import { useActionGuard } from './useActionGuard';

// Ausgewählte Spieler werden als vollständiges Objekt im Zustand gehalten
// (nicht nur als ID): So zeigt die Bestätigungsseite immer den zum
// Auswahlzeitpunkt angezeigten Namen, auch falls sich die Live-Query auf
// aktive Spieler bis zur Bestätigung ändert. Die Existenzprüfung vor dem
// Speichern erfolgt zusätzlich frisch über `getPlayer`.
type TouchdownStep =
  | { kind: 'select-type' }
  | { kind: 'select-scorer' }
  | { kind: 'select-qb' }
  | { kind: 'select-receiver'; qb: Player }
  | { kind: 'confirm-rushing'; scorer: Player }
  | { kind: 'confirm-passing'; qb: Player; receiver: Player }
  | { kind: 'confirm-opponent' };

interface TouchdownFlowProps {
  game: Game;
  /** Legt fest, ob der eigene oder der gegnerische Touchdown-Flow läuft. */
  team: Team;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

/**
 * Auswahl- und Bestätigungs-Flow für einen Touchdown (PRD §16, §17). Läuft
 * vollständig als lokaler React-Zustand innerhalb des Live-Spielbildschirms
 * (kein eigenes Routing). Vor "Bestätigen" wird nichts gespeichert.
 */
export function TouchdownFlow({ game, team, onCancel, onSaved }: TouchdownFlowProps) {
  const activePlayers = useLiveQuery(() => listActivePlayers(), []) ?? [];
  const [step, setStep] = useState<TouchdownStep>(
    team === TEAM.OPPONENT ? { kind: 'confirm-opponent' } : { kind: 'select-type' },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Zusätzlich zu `isSaving` (steuert nur `disabled` in der UI, sichtbar
  // erst beim nächsten Render) ein synchroner Guard gegen echte
  // überlappende Doppelklicks auf "Bestätigen" – siehe `useActionGuard`.
  const actionGuard = useActionGuard();

  const selectType = (variant: TouchdownVariant) => {
    setError(null);
    setStep(variant === 'RUSHING' ? { kind: 'select-scorer' } : { kind: 'select-qb' });
  };

  const selectScorer = (scorer: Player) => {
    setError(null);
    setStep({ kind: 'confirm-rushing', scorer });
  };

  const selectQb = (qb: Player) => {
    setError(null);
    setStep({ kind: 'select-receiver', qb });
  };

  const selectReceiver = (receiver: Player) => {
    if (step.kind !== 'select-receiver') {
      return;
    }
    setError(null);
    setStep({ kind: 'confirm-passing', qb: step.qb, receiver });
  };

  const handleConfirm = async () => {
    // `actionGuard.run` setzt den Doppelklick-Schutz synchron VOR dem ersten
    // `await` und gibt ihn danach garantiert wieder frei (siehe
    // `useActionGuard`) – ein zweiter, wirklich überlappender Klick auf
    // "Bestätigen" führt so nie zu einem doppelt gespeicherten Event.
    await actionGuard.run(async () => {
      setError(null);
      setIsSaving(true);
      try {
        const half = resolveCurrentHalf(game.status);

        if (step.kind === 'confirm-rushing') {
          const scorer = await getPlayer(step.scorer.id);
          if (!scorer) {
            throw new Error(
              'Der ausgewählte Spieler existiert nicht mehr. Bitte erneut auswählen.',
            );
          }
          await createEvent(
            buildRushingTouchdownEvent({ gameId: game.id, half, scorerId: scorer.id }),
          );
          const scoreAfter = calculateScore(await listEventsByGame(game.id));
          onSaved(
            formatTouchdownMessage({
              team: TEAM.PHOENIX,
              opponentName: game.opponent,
              variant: 'RUSHING',
              scorerLabel: formatPlayerLabel(scorer),
              scoreAfter,
            }),
          );
          return;
        }

        if (step.kind === 'confirm-passing') {
          const [qb, receiver] = await Promise.all([
            getPlayer(step.qb.id),
            getPlayer(step.receiver.id),
          ]);
          if (!qb || !receiver) {
            throw new Error(
              'Mindestens einer der ausgewählten Spieler existiert nicht mehr. Bitte erneut auswählen.',
            );
          }
          await createEvent(
            buildPassingTouchdownEvent({
              gameId: game.id,
              half,
              qbId: qb.id,
              receiverId: receiver.id,
            }),
          );
          const scoreAfter = calculateScore(await listEventsByGame(game.id));
          onSaved(
            formatTouchdownMessage({
              team: TEAM.PHOENIX,
              opponentName: game.opponent,
              variant: 'PASSING',
              qbLabel: formatPlayerLabel(qb),
              receiverLabel: formatPlayerLabel(receiver),
              scoreAfter,
            }),
          );
          return;
        }

        if (step.kind === 'confirm-opponent') {
          await createEvent(buildOpponentTouchdownEvent({ gameId: game.id, half }));
          const scoreAfter = calculateScore(await listEventsByGame(game.id));
          onSaved(
            formatTouchdownMessage({
              team: TEAM.OPPONENT,
              opponentName: game.opponent,
              scoreAfter,
            }),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <FlowOverlay title="Touchdown" onCancel={onCancel} error={error}>
      {step.kind === 'select-type' && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-slate-300">Art des Touchdowns</p>
          <button
            type="button"
            onClick={() => selectType('RUSHING')}
            className="rounded-xl bg-slate-800 px-4 py-5 text-lg font-semibold hover:bg-slate-700"
          >
            Rushing
          </button>
          <button
            type="button"
            onClick={() => selectType('PASSING')}
            className="rounded-xl bg-slate-800 px-4 py-5 text-lg font-semibold hover:bg-slate-700"
          >
            Passing
          </button>
        </div>
      )}

      {step.kind === 'select-scorer' && (
        <PlayerPicker
          prompt="Welcher Spieler hat den Touchdown erzielt?"
          players={activePlayers}
          onSelect={selectScorer}
        />
      )}

      {step.kind === 'select-qb' && (
        <PlayerPicker
          prompt="Wer hat den Touchdown geworfen?"
          players={activePlayers}
          onSelect={selectQb}
        />
      )}

      {step.kind === 'select-receiver' && (
        <PlayerPicker
          prompt="Wer hat den Touchdown gefangen?"
          players={activePlayers.filter((player) => player.id !== step.qb.id)}
          onSelect={selectReceiver}
        />
      )}

      {step.kind === 'confirm-rushing' && (
        <ConfirmView
          lines={['Touchdown Regensburg Phoenix', formatPlayerLabel(step.scorer)]}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}

      {step.kind === 'confirm-passing' && (
        <ConfirmView
          lines={[
            'Touchdown Regensburg Phoenix',
            `${formatPlayerLabel(step.qb)} → ${formatPlayerLabel(step.receiver)}`,
          ]}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}

      {step.kind === 'confirm-opponent' && (
        <ConfirmView
          lines={[`Touchdown ${game.opponent}`]}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </FlowOverlay>
  );
}
