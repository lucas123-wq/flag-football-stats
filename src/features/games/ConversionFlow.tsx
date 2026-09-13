import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createEvent, listEventsByGame } from '../../data/events';
import { getPlayer, listActivePlayers } from '../../data/players';
import { calculateScore } from '../../domain/scoring';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import { buildConversionEvent, formatConversionMessage } from '../../domain/conversion';
import { formatPlayerLabel } from '../../domain/touchdown';
import { TEAM } from '../../domain/types';
import type { ConversionType } from '../../domain/conversion';
import type { Game, Player, Team } from '../../domain/types';
import { ConfirmView, FlowOverlay, PlayerPicker } from './EventFlowUI';
import { useActionGuard } from './useActionGuard';

// Wie bei `TouchdownFlow`: der ausgewählte Spieler wird als vollständiges
// Objekt im Zustand gehalten (nicht nur als ID) für eine stabile Anzeige auf
// der Bestätigungsseite; die Existenzprüfung vor dem Speichern erfolgt
// zusätzlich frisch über `getPlayer`.
type ConversionStep =
  | { kind: 'select-outcome' }
  | { kind: 'select-scorer' }
  | { kind: 'confirm'; successful: boolean; scorer?: Player };

interface ConversionFlowProps {
  game: Game;
  /** Legt fest, ob der eigene oder der gegnerische Conversion-Flow läuft. */
  team: Team;
  conversionType: ConversionType;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

const CONVERSION_LABEL: Record<ConversionType, string> = {
  '1PT': '1-Punkt-Conversion',
  '2PT': '2-Punkt-Conversion',
};

/**
 * Auswahl- und Bestätigungs-Flow für eine 1-/2-Punkt-Conversion (PRD §18,
 * §19). Läuft wie `TouchdownFlow` vollständig als lokaler React-Zustand
 * (kein eigenes Routing). Vor "Bestätigen" wird nichts gespeichert.
 */
export function ConversionFlow({
  game,
  team,
  conversionType,
  onCancel,
  onSaved,
}: ConversionFlowProps) {
  const activePlayers = useLiveQuery(() => listActivePlayers(), []) ?? [];
  const [step, setStep] = useState<ConversionStep>({ kind: 'select-outcome' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchroner Guard gegen echte überlappende Doppelklicks auf "Bestätigen"
  // (siehe `useActionGuard`) – zusätzlich zu `isSaving`.
  const actionGuard = useActionGuard();

  const label = CONVERSION_LABEL[conversionType];
  const teamName = team === TEAM.PHOENIX ? 'Regensburg Phoenix' : game.opponent;

  const selectOutcome = (successful: boolean) => {
    setError(null);
    // Nur eine erfolgreiche EIGENE Conversion benötigt eine Spielerauswahl
    // (PRD §18/§19) – bei Misserfolg oder beim Gegner geht es direkt zur
    // Bestätigung.
    if (successful && team === TEAM.PHOENIX) {
      setStep({ kind: 'select-scorer' });
    } else {
      setStep({ kind: 'confirm', successful });
    }
  };

  const selectScorer = (scorer: Player) => {
    setError(null);
    setStep({ kind: 'confirm', successful: true, scorer });
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
          buildConversionEvent({
            gameId: game.id,
            half,
            conversionType,
            team,
            successful: step.successful,
            scorerId: scorer?.id,
          }),
        );
        const scoreAfter = calculateScore(await listEventsByGame(game.id));
        onSaved(
          formatConversionMessage({
            conversionType,
            team,
            opponentName: game.opponent,
            successful: step.successful,
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
      {step.kind === 'select-outcome' && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-slate-300">Conversion erfolgreich?</p>
          <button
            type="button"
            onClick={() => selectOutcome(true)}
            className="rounded-xl bg-slate-800 px-4 py-5 text-lg font-semibold hover:bg-slate-700"
          >
            Erfolgreich
          </button>
          <button
            type="button"
            onClick={() => selectOutcome(false)}
            className="rounded-xl bg-slate-800 px-4 py-5 text-lg font-semibold hover:bg-slate-700"
          >
            Fehlgeschlagen
          </button>
        </div>
      )}

      {step.kind === 'select-scorer' && (
        <PlayerPicker
          prompt="Welcher Spieler hat die Conversion erzielt?"
          players={activePlayers}
          onSelect={selectScorer}
        />
      )}

      {step.kind === 'confirm' && (
        <ConfirmView
          lines={[
            `${label} ${teamName}`,
            ...(step.successful
              ? step.scorer
                ? [formatPlayerLabel(step.scorer)]
                : []
              : ['Fehlgeschlagen']),
          ]}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </FlowOverlay>
  );
}
