import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { updateEvent } from '../../data/events';
import { getPlayer, listPlayers } from '../../data/players';
import { buildConversionEvent } from '../../domain/conversion';
import type { ConversionType } from '../../domain/conversion';
import { getEventEditKind } from '../../domain/eventEditing';
import { buildFirstDownEvent } from '../../domain/firstDown';
import { buildInterceptionEvent } from '../../domain/interception';
import { buildPickEvent } from '../../domain/pick';
import type { PickVariant } from '../../domain/pick';
import { buildSackEvent } from '../../domain/sack';
import { buildSafetyEvent } from '../../domain/safety';
import type { SafetyVariant } from '../../domain/safety';
import {
  buildPassingTouchdownEvent,
  buildRushingTouchdownEvent,
  formatPlayerLabel,
} from '../../domain/touchdown';
import { EVENT_TYPE, TEAM } from '../../domain/types';
import type { Game, GameEvent, Player } from '../../domain/types';
import { FlowOverlay, PlayerPicker } from './EventFlowUI';

interface EventEditFlowProps {
  game: Game;
  event: GameEvent;
  onCancel: () => void;
  /**
   * Wird nach erfolgreichem Speichern aufgerufen – bewusst OHNE Nachrichten-
   * Parameter: eine Korrektur erzeugt laut PRD §42 keine neue WhatsApp-
   * Nachricht.
   */
  onSaved: () => void;
}

type Step =
  | { kind: 'summary' }
  | { kind: 'pick-scorer' }
  | { kind: 'pick-qb' }
  | { kind: 'pick-receiver' }
  | { kind: 'pick-outcome' };

const SINGLE_PLAYER_LABEL: Partial<Record<string, string>> = {
  [EVENT_TYPE.TOUCHDOWN_RUSHING]: 'Touchdown Regensburg Phoenix',
  [EVENT_TYPE.FIRST_DOWN]: 'First Down Regensburg Phoenix',
  [EVENT_TYPE.INTERCEPTION]: 'Interception Regensburg Phoenix',
  [EVENT_TYPE.PICK_6]: 'Pick 6 Regensburg Phoenix',
  [EVENT_TYPE.PICK_2]: 'Pick 2 Regensburg Phoenix',
  [EVENT_TYPE.SACK]: 'Sack Regensburg Phoenix',
  [EVENT_TYPE.SAFETY]: 'Safety Regensburg Phoenix',
  [EVENT_TYPE.SAFETY_1PT]: '1-Punkt-Safety Regensburg Phoenix',
};

const CONVERSION_LABEL: Record<string, string> = {
  [EVENT_TYPE.CONVERSION_1PT]: '1-Punkt-Conversion',
  [EVENT_TYPE.CONVERSION_2PT]: '2-Punkt-Conversion',
};

/**
 * Bearbeiten-Flow für ein einzelnes Event (PRD §41). Wiederverwendet
 * `FlowOverlay`/`PlayerPicker` aus `EventFlowUI.tsx` sowie – für die
 * eigentliche Feldänderung – dieselben Domain-Builder, die auch die
 * jeweilige Erfassung (Schritt 6–14 dieses Projekts) verwendet, damit
 * `points` niemals manuell, sondern immer über dieselbe geprüfte Logik wie
 * bei der Neuanlage berechnet wird. `type`, `team` und `half` werden dabei
 * NIE verändert (PRD-Vorgabe dieses Schritts).
 *
 * Startet immer auf der Zusammenfassungsseite mit den aktuellen Werten
 * ("aktuelle Werte vorausfüllen") – einzelne Felder werden über "Ändern"
 * gezielt neu ausgewählt, nicht der gesamte Vorgang von vorne durchlaufen.
 */
export function EventEditFlow({ game, event, onCancel, onSaved }: EventEditFlowProps) {
  const allPlayers = useLiveQuery(() => listPlayers(), []) ?? [];
  const activePlayers = allPlayers.filter((player) => player.active);
  const playerById = new Map(allPlayers.map((player) => [player.id, player]));

  const [step, setStep] = useState<Step>({ kind: 'summary' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overrideScorer, setOverrideScorer] = useState<Player | null>(null);
  const [overrideQb, setOverrideQb] = useState<Player | null>(null);
  const [overrideReceiver, setOverrideReceiver] = useState<Player | null>(null);
  const [overrideSuccessful, setOverrideSuccessful] = useState<boolean | null>(null);

  const currentScorer = event.playerId ? (playerById.get(event.playerId) ?? null) : null;
  const currentQb = event.qbId ? (playerById.get(event.qbId) ?? null) : null;
  const currentReceiver = event.receiverId ? (playerById.get(event.receiverId) ?? null) : null;

  const effectiveScorer = overrideScorer ?? currentScorer;
  const effectiveQb = overrideQb ?? currentQb;
  const effectiveReceiver = overrideReceiver ?? currentReceiver;
  const effectiveSuccessful = overrideSuccessful ?? event.successful ?? false;

  const editKind = getEventEditKind(event);
  const teamName = event.team === TEAM.PHOENIX ? 'Regensburg Phoenix' : game.opponent;

  const selectScorer = (player: Player) => {
    setError(null);
    setOverrideScorer(player);
    setStep({ kind: 'summary' });
  };

  const selectQb = (player: Player) => {
    setError(null);
    setOverrideQb(player);
    setStep({ kind: 'summary' });
  };

  const selectReceiver = (player: Player) => {
    setError(null);
    setOverrideReceiver(player);
    setStep({ kind: 'summary' });
  };

  const selectOutcome = (successful: boolean) => {
    setError(null);
    setOverrideSuccessful(successful);
    if (successful && event.team === TEAM.PHOENIX) {
      setStep({ kind: 'pick-scorer' });
    } else {
      setStep({ kind: 'summary' });
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      let changes: Pick<GameEvent, 'playerId' | 'qbId' | 'receiverId' | 'successful' | 'points'>;

      if (event.type === EVENT_TYPE.TOUCHDOWN_PASSING) {
        if (!effectiveQb || !effectiveReceiver) {
          throw new Error('Bitte QB und Receiver auswählen.');
        }
        const [freshQb, freshReceiver] = await Promise.all([
          getPlayer(effectiveQb.id),
          getPlayer(effectiveReceiver.id),
        ]);
        if (!freshQb || !freshReceiver) {
          throw new Error(
            'Mindestens einer der ausgewählten Spieler existiert nicht mehr. Bitte erneut auswählen.',
          );
        }
        const built = buildPassingTouchdownEvent({
          gameId: event.gameId,
          half: event.half,
          qbId: freshQb.id,
          receiverId: freshReceiver.id,
        });
        changes = {
          playerId: null,
          qbId: built.qbId ?? null,
          receiverId: built.receiverId ?? null,
          successful: null,
          points: built.points,
        };
      } else if (
        event.type === EVENT_TYPE.CONVERSION_1PT ||
        event.type === EVENT_TYPE.CONVERSION_2PT
      ) {
        const conversionType: ConversionType =
          event.type === EVENT_TYPE.CONVERSION_1PT ? '1PT' : '2PT';
        let scorerId: string | undefined;
        if (effectiveSuccessful && event.team === TEAM.PHOENIX) {
          if (!effectiveScorer) {
            throw new Error('Bitte einen Spieler auswählen.');
          }
          const fresh = await getPlayer(effectiveScorer.id);
          if (!fresh) {
            throw new Error(
              'Der ausgewählte Spieler existiert nicht mehr. Bitte erneut auswählen.',
            );
          }
          scorerId = fresh.id;
        }
        const built = buildConversionEvent({
          gameId: event.gameId,
          half: event.half,
          conversionType,
          team: event.team ?? TEAM.PHOENIX,
          successful: effectiveSuccessful,
          scorerId,
        });
        changes = {
          playerId: built.playerId ?? null,
          qbId: null,
          receiverId: null,
          successful: built.successful ?? null,
          points: built.points,
        };
      } else {
        // single-player: Rushing TD, First Down, Interception, Pick 6/2, Sack, Safety/1-Punkt-Safety.
        if (!effectiveScorer) {
          throw new Error('Bitte einen Spieler auswählen.');
        }
        const fresh = await getPlayer(effectiveScorer.id);
        if (!fresh) {
          throw new Error('Der ausgewählte Spieler existiert nicht mehr. Bitte erneut auswählen.');
        }
        const built = buildSinglePlayerEvent(event, fresh.id);
        changes = {
          playerId: built.playerId ?? null,
          qbId: null,
          receiverId: null,
          successful: null,
          points: built.points,
        };
      }

      await updateEvent(event.id, changes);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FlowOverlay title="Event bearbeiten" onCancel={onCancel} error={error}>
      {step.kind === 'summary' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl bg-slate-900 px-4 py-6">
            {editKind === 'passing' && (
              <>
                <SummaryField
                  label="QB"
                  value={effectiveQb ? formatPlayerLabel(effectiveQb) : 'Nicht ausgewählt'}
                  onChange={() => setStep({ kind: 'pick-qb' })}
                />
                <SummaryField
                  label="Receiver"
                  value={
                    effectiveReceiver ? formatPlayerLabel(effectiveReceiver) : 'Nicht ausgewählt'
                  }
                  onChange={() => setStep({ kind: 'pick-receiver' })}
                />
              </>
            )}

            {editKind === 'conversion' && (
              <>
                <p className="text-base font-semibold">
                  {CONVERSION_LABEL[event.type]} {teamName}
                </p>
                <SummaryField
                  label="Ergebnis"
                  value={effectiveSuccessful ? 'Erfolgreich' : 'Fehlgeschlagen'}
                  onChange={() => setStep({ kind: 'pick-outcome' })}
                />
                {effectiveSuccessful && event.team === TEAM.PHOENIX && (
                  <SummaryField
                    label="Spieler"
                    value={
                      effectiveScorer ? formatPlayerLabel(effectiveScorer) : 'Nicht ausgewählt'
                    }
                    onChange={() => setStep({ kind: 'pick-scorer' })}
                  />
                )}
              </>
            )}

            {editKind === 'single-player' && (
              <>
                <p className="text-base font-semibold">{SINGLE_PLAYER_LABEL[event.type]}</p>
                <SummaryField
                  label="Spieler"
                  value={effectiveScorer ? formatPlayerLabel(effectiveScorer) : 'Nicht ausgewählt'}
                  onChange={() => setStep({ kind: 'pick-scorer' })}
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400 disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-xl bg-slate-800 px-4 py-4 text-lg font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {step.kind === 'pick-scorer' && (
        <PlayerPicker prompt="Welcher Spieler?" players={activePlayers} onSelect={selectScorer} />
      )}

      {step.kind === 'pick-qb' && (
        <PlayerPicker
          prompt="Wer hat den Touchdown geworfen?"
          players={activePlayers.filter((player) => player.id !== effectiveReceiver?.id)}
          onSelect={selectQb}
        />
      )}

      {step.kind === 'pick-receiver' && (
        <PlayerPicker
          prompt="Wer hat den Touchdown gefangen?"
          players={activePlayers.filter((player) => player.id !== effectiveQb?.id)}
          onSelect={selectReceiver}
        />
      )}

      {step.kind === 'pick-outcome' && (
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
    </FlowOverlay>
  );
}

interface SummaryFieldProps {
  label: string;
  value: string;
  onChange: () => void;
}

function SummaryField({ label, value, onChange }: SummaryFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
        <p className="text-base">{value}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
      >
        Ändern
      </button>
    </div>
  );
}

/**
 * Baut das aktualisierte Event für alle Einzelspieler-Typen über denselben
 * Builder, der auch bei der Neuanlage verwendet wird (siehe jeweiliges
 * Domain-Modul) – `type`/`team`/`half` bleiben dabei unverändert, nur
 * `playerId` (und der davon abhängige, bereits geprüfte `points`-Wert)
 * ändert sich.
 */
function buildSinglePlayerEvent(event: GameEvent, scorerId: string) {
  const gameId = event.gameId;
  const half = event.half;
  const team = event.team ?? TEAM.PHOENIX;

  switch (event.type) {
    case EVENT_TYPE.TOUCHDOWN_RUSHING:
      return buildRushingTouchdownEvent({ gameId, half, scorerId });
    case EVENT_TYPE.FIRST_DOWN:
      return buildFirstDownEvent({ gameId, half, team, scorerId });
    case EVENT_TYPE.INTERCEPTION:
      return buildInterceptionEvent({ gameId, half, team, scorerId });
    case EVENT_TYPE.PICK_6:
      return buildPickEvent({ gameId, half, team, variant: 'SIX' as PickVariant, scorerId });
    case EVENT_TYPE.PICK_2:
      return buildPickEvent({ gameId, half, team, variant: 'TWO' as PickVariant, scorerId });
    case EVENT_TYPE.SACK:
      return buildSackEvent({ gameId, half, team, scorerId });
    case EVENT_TYPE.SAFETY:
      return buildSafetyEvent({ gameId, half, team, variant: 'SAFETY' as SafetyVariant, scorerId });
    case EVENT_TYPE.SAFETY_1PT:
      return buildSafetyEvent({
        gameId,
        half,
        team,
        variant: 'SAFETY_1PT' as SafetyVariant,
        scorerId,
      });
    default:
      throw new Error(`Dieses Event kann nicht bearbeitet werden: ${event.type}`);
  }
}
