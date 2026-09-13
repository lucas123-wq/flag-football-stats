import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../data/db';
import { createEvent, deleteEvent, listEventsByGame } from '../../data/events';
import { deleteGame, setGameStatus } from '../../data/games';
import { listPlayers } from '../../data/players';
import { ConversionFlow } from './ConversionFlow';
import { EventButtonGrid } from './EventButtonGrid';
import { EventEditFlow } from './EventEditFlow';
import { EventTicker } from './EventTicker';
import { FirstDownFlow } from './FirstDownFlow';
import { formatGameDate } from './gameFormatting';
import { GameStatusBadge } from './GameStatusBadge';
import { GameTabs } from './GameTabs';
import { InterceptionFlow } from './InterceptionFlow';
import { OPPONENT_EVENT_BUTTONS, OWN_TEAM_EVENT_BUTTONS } from './liveEventButtons';
import { PickFlow } from './PickFlow';
import { SackFlow } from './SackFlow';
import { SafetyFlow } from './SafetyFlow';
import { Scoreboard } from './Scoreboard';
import { TouchdownFlow } from './TouchdownFlow';
import { TurnoverOnDownsFlow } from './TurnoverOnDownsFlow';
import { useActionGuard } from './useActionGuard';
import { canDeleteEvent, canEditEvent } from '../../domain/eventEditing';
import {
  buildGameEndEvent,
  buildHalftimeEvent,
  buildSecondHalfStartEvent,
  buildTwoMinuteWarningEvent,
  canFinishGame,
  canRecordEvents,
  canResumeSecondHalf,
  canStartHalftime,
  canTriggerTwoMinuteWarning,
  formatGameEndMessage,
  formatHalftimeMessage,
  formatSecondHalfStartMessage,
  formatTwoMinuteWarningMessage,
} from '../../domain/gameFlow';
import { resolveCurrentHalf } from '../../domain/gameHalf';
import { buildTickerEntries, recentTickerEntries } from '../../domain/liveTicker';
import { calculateScore } from '../../domain/scoring';
import { GAME_STATUS, HALF, TEAM } from '../../domain/types';
import type { ConversionType } from '../../domain/conversion';
import type { PickVariant } from '../../domain/pick';
import type { SafetyVariant } from '../../domain/safety';
import type { Game, GameEvent, Team } from '../../domain/types';
import type { LiveEventButtonConfig } from './liveEventButtons';

/** PRD §36: "Letzte Events" zeigt eine kurze, feste Auswahl der jüngsten Einträge. */
const RECENT_EVENTS_LIMIT = 3;

type GameLookup = { mode: 'found'; game: Game } | { mode: 'not-found' };

/** Wie bei `PlayerFormPage`: unterscheidet über eine Live-Query "lädt noch" von "nicht gefunden". */
function useGameLookup(gameId: string | undefined): GameLookup | undefined {
  return useLiveQuery(async (): Promise<GameLookup> => {
    if (!gameId) {
      return { mode: 'not-found' };
    }
    const game = await db.games.get(gameId);
    return game ? { mode: 'found', game } : { mode: 'not-found' };
  }, [gameId]);
}

/** Schlüssel des Touchdown-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const TOUCHDOWN_BUTTON_KEYS: Record<string, Team> = {
  touchdown: TEAM.PHOENIX,
  'opponent-touchdown': TEAM.OPPONENT,
};

/** Schlüssel der Conversion-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const CONVERSION_BUTTON_KEYS: Record<string, { team: Team; conversionType: ConversionType }> = {
  'conversion-1pt': { team: TEAM.PHOENIX, conversionType: '1PT' },
  'conversion-2pt': { team: TEAM.PHOENIX, conversionType: '2PT' },
  'opponent-conversion-1pt': { team: TEAM.OPPONENT, conversionType: '1PT' },
  'opponent-conversion-2pt': { team: TEAM.OPPONENT, conversionType: '2PT' },
};

/** Schlüssel des First-Down-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const FIRST_DOWN_BUTTON_KEYS: Record<string, Team> = {
  'first-down': TEAM.PHOENIX,
  'opponent-first-down': TEAM.OPPONENT,
};

/** Schlüssel des Interception-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const INTERCEPTION_BUTTON_KEYS: Record<string, Team> = {
  interception: TEAM.PHOENIX,
  'opponent-interception': TEAM.OPPONENT,
};

/** Schlüssel des Sack-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const SACK_BUTTON_KEYS: Record<string, Team> = {
  sack: TEAM.PHOENIX,
  'opponent-sack': TEAM.OPPONENT,
};

/** Schlüssel der Pick-6-/Pick-2-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const PICK_BUTTON_KEYS: Record<string, { team: Team; variant: PickVariant }> = {
  'pick-6': { team: TEAM.PHOENIX, variant: 'SIX' },
  'pick-2': { team: TEAM.PHOENIX, variant: 'TWO' },
  'opponent-pick-6': { team: TEAM.OPPONENT, variant: 'SIX' },
  'opponent-pick-2': { team: TEAM.OPPONENT, variant: 'TWO' },
};

/** Schlüssel der Safety-/1-Punkt-Safety-Buttons je Bereich aus `liveEventButtons.ts` (siehe dort). */
const SAFETY_BUTTON_KEYS: Record<string, { team: Team; variant: SafetyVariant }> = {
  safety: { team: TEAM.PHOENIX, variant: 'SAFETY' },
  'safety-1pt': { team: TEAM.PHOENIX, variant: 'SAFETY_1PT' },
  'opponent-safety': { team: TEAM.OPPONENT, variant: 'SAFETY' },
  'opponent-safety-1pt': { team: TEAM.OPPONENT, variant: 'SAFETY_1PT' },
};

/**
 * Schlüssel des Turnover-on-Downs-Buttons je Bereich aus `liveEventButtons.ts`
 * (siehe dort). Turnover on Downs ist eine NEGATIVE Statistik: der
 * Eigene-Mannschaft-Button wird geklickt, wenn die EIGENE Offense den Ball
 * durch Nicht-Erreichen des First Downs verliert (`team: TEAM.PHOENIX`),
 * der Gegner-Button entsprechend, wenn der GEGNER den Ball verliert (siehe
 * `domain/turnoverOnDowns.ts`).
 */
const TURNOVER_ON_DOWNS_BUTTON_KEYS: Record<string, Team> = {
  'turnover-on-downs': TEAM.PHOENIX,
  'opponent-turnover-on-downs': TEAM.OPPONENT,
};

/**
 * Live-Spielbildschirm. Touchdown, 1-/2-Punkt-Conversion, First Down,
 * Interception, Pick 6, Pick 2, Sack, Safety und 1-Punkt-Safety sind die
 * implementierten Event-Typen mit echter Funktion. Zusätzlich der
 * Spielablauf Halbzeit → "Weiter geht's" → 2-Minuten-Warnung → Spielende
 * (siehe `domain/gameFlow.ts`, PRD §27–§31): Jede dieser vier Aktionen
 * speichert wie in der PRD vorgesehen ein eigenes Steuerungs-`GameEvent`
 * (`HALFTIME`/`SECOND_HALF_START`/`TWO_MIN_WARNING`/`GAME_END`) mit
 * `team: null` und `points: 0` und ändert zusätzlich `Game.status` (außer
 * 2-Minuten-Warnung, die nur das Event erzeugt).
 *
 * Score-Hinweis (PRD §35): Der Spielstand wird NICHT am `Game`-Datensatz
 * gespeichert, sondern bei jeder Anzeige live aus den Events berechnet
 * (`calculateScore`) – Steuerungs-Events tragen wegen `team: null`/
 * `points: 0` nie dazu bei.
 *
 * Liveticker + Bearbeiten/Löschen (PRD §36, §39, §41, §42, siehe
 * `domain/liveTicker.ts`/`domain/eventEditing.ts`): "Letzte Events" und der
 * vollständige Liveticker teilen sich dieselben `TickerEntry`-Daten (eine
 * eigene, WhatsApp-unabhängige Darstellung ohne "Neuer Spielstand:"-Zeilen).
 * Bearbeiten (`EventEditFlow`) und Löschen sind ausschließlich bei
 * `Game.status === FINAL` verfügbar und nie für die vier Steuerungs-Events –
 * `Game.status` wird nicht aus ihnen abgeleitet, ein Löschen/Ändern würde
 * Status und Event-Historie inkonsistent werden lassen. Eine Korrektur
 * erzeugt bewusst keine neue WhatsApp-Nachricht.
 *
 * Tab-Struktur für abgeschlossene Spiele (PRD §37, siehe `GameTabs.tsx`):
 * Solange `!isFinal`, bleibt der Live-Spielbildschirm (Event-Erfassung,
 * Spielablauf-Buttons, "Letzte Events") unverändert wie bisher bestehen –
 * §37 gilt wörtlich nur für "ein abgeschlossenes Spiel". Sobald `isFinal`,
 * ersetzt die Tab-Struktur (ÜBERSICHT/LIVETICKER/STATISTIKEN/BEARBEITEN)
 * die Event-Erfassungsbuttons; der gemeinsame Kopfbereich (Zurück-Link,
 * Datum, Scoreboard, Status, ggf. letzte WhatsApp-Nachricht) bleibt in
 * beiden Fällen gleich und wird nur einmal gerendert.
 */
export function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const lookup = useGameLookup(gameId);
  const navigate = useNavigate();
  const [isBusy, setIsBusy] = useState(false);
  // Zusätzlich zu `isBusy` (steuert nur `disabled` in der UI, sichtbar erst
  // beim nächsten Render) ein synchroner Guard als echter Doppelklick-Schutz
  // (siehe `useActionGuard`) – verhindert zuverlässig, dass zwei schnell
  // aufeinanderfolgende Klicks (z. B. `dblClick`) beide noch den alten
  // `isBusy=false`-Stand sehen und dadurch doppelt ausgeführt werden
  // (betrifft Halbzeit/Weiter geht's/2-Minuten/Spielende sowie
  // Event-Löschen). Derselbe Baustein wird auch von den einzelnen
  // Event-Erfassungs-Flows verwendet (`TouchdownFlow.tsx` etc.).
  const actionGuard = useActionGuard();
  const [actionError, setActionError] = useState<string | null>(null);
  const [placeholderNotice, setPlaceholderNotice] = useState<string | null>(null);
  const [touchdownTeam, setTouchdownTeam] = useState<Team | null>(null);
  const [conversionFlow, setConversionFlow] = useState<{
    team: Team;
    conversionType: ConversionType;
  } | null>(null);
  const [firstDownTeam, setFirstDownTeam] = useState<Team | null>(null);
  const [interceptionTeam, setInterceptionTeam] = useState<Team | null>(null);
  const [sackTeam, setSackTeam] = useState<Team | null>(null);
  const [pickFlow, setPickFlow] = useState<{ team: Team; variant: PickVariant } | null>(null);
  const [safetyFlow, setSafetyFlow] = useState<{ team: Team; variant: SafetyVariant } | null>(null);
  const [turnoverOnDownsTeam, setTurnoverOnDownsTeam] = useState<Team | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);
  const [showFullTicker, setShowFullTicker] = useState(false);

  const events = useLiveQuery(() => (gameId ? listEventsByGame(gameId) : []), [gameId]) ?? [];
  const score = calculateScore(events);
  const allPlayers = useLiveQuery(() => listPlayers(), []) ?? [];

  if (lookup === undefined) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-slate-950 px-4 pt-6 text-slate-50">
        <p className="text-slate-400">Lade…</p>
      </div>
    );
  }

  if (lookup.mode === 'not-found') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-slate-950 px-4 pt-6 text-slate-50">
        <p role="alert" className="text-red-300">
          Spiel wurde nicht gefunden.
        </p>
        <Link to="/spiele" className="text-orange-400 underline">
          Zurück zu Spielen
        </Link>
      </div>
    );
  }

  const { game } = lookup;
  const isFinal = game.status === GAME_STATUS.FINAL;

  const playerById = new Map(allPlayers.map((player) => [player.id, player]));
  const tickerEntries = buildTickerEntries(events, game.opponent, (id) => playerById.get(id));
  const recentEntries = recentTickerEntries(tickerEntries, RECENT_EVENTS_LIMIT);

  // Zeigt eine erzeugte Nachricht an und setzt alle offenen Event-Flows
  // zurück (bei Halbzeit/2-Minuten-Warnung ist ohnehin keiner offen).
  const showMessage = (message: string) => {
    setTouchdownTeam(null);
    setConversionFlow(null);
    setFirstDownTeam(null);
    setInterceptionTeam(null);
    setSackTeam(null);
    setPickFlow(null);
    setSafetyFlow(null);
    setTurnoverOnDownsTeam(null);
    setLastMessage(message);
    setCopyState('idle');
  };

  // Reihenfolge Event/Status je Aktion folgt exakt der PRD (§28/§30/§31):
  // Halbzeit und Spielende speichern zuerst das Event und ändern danach den
  // Status; "Weiter geht's" ändert zuerst den Status und speichert danach
  // das Event.
  const handleStartHalftime = async () => {
    if (!canStartHalftime(game.status) || actionGuard.isInFlight()) {
      return;
    }
    await actionGuard.run(async () => {
      setActionError(null);
      setIsBusy(true);
      try {
        const half = resolveCurrentHalf(game.status);
        await createEvent(buildHalftimeEvent({ gameId: game.id, half }));
        await setGameStatus(game.id, GAME_STATUS.HALFTIME);
        const scoreAfter = calculateScore(await listEventsByGame(game.id));
        showMessage(formatHalftimeMessage({ opponentName: game.opponent, score: scoreAfter }));
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.');
      } finally {
        setIsBusy(false);
      }
    });
  };

  const handleResumeSecondHalf = async () => {
    if (!canResumeSecondHalf(game.status) || actionGuard.isInFlight()) {
      return;
    }
    await actionGuard.run(async () => {
      setActionError(null);
      setIsBusy(true);
      try {
        await setGameStatus(game.id, GAME_STATUS.LIVE_SECOND_HALF);
        await createEvent(buildSecondHalfStartEvent({ gameId: game.id, half: HALF.SECOND }));
        const scoreAfter = calculateScore(await listEventsByGame(game.id));
        showMessage(
          formatSecondHalfStartMessage({ opponentName: game.opponent, score: scoreAfter }),
        );
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.');
      } finally {
        setIsBusy(false);
      }
    });
  };

  const handleTwoMinuteWarning = async () => {
    if (!canTriggerTwoMinuteWarning(game.status) || actionGuard.isInFlight()) {
      return;
    }
    await actionGuard.run(async () => {
      setActionError(null);
      setIsBusy(true);
      try {
        const half = resolveCurrentHalf(game.status);
        await createEvent(buildTwoMinuteWarningEvent({ gameId: game.id, half }));
        const scoreAfter = calculateScore(await listEventsByGame(game.id));
        showMessage(formatTwoMinuteWarningMessage({ score: scoreAfter }));
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.');
      } finally {
        setIsBusy(false);
      }
    });
  };

  const handleFinishGame = async () => {
    if (!canFinishGame(game.status) || actionGuard.isInFlight()) {
      return;
    }
    // Guard bereits vor `window.confirm()` setzen: verhindert, dass ein
    // zweiter, sehr schnell folgender Klick (in Tests wird `confirm`
    // nicht-blockierend gemockt) den Bestätigungsdialog ein zweites Mal
    // auslöst.
    actionGuard.begin();
    const confirmed = window.confirm(
      `Spiel wirklich beenden?\n\nRegensburg Phoenix vs. ${game.opponent}\nEndstand: ${score.phoenix}:${score.opponent}`,
    );
    if (!confirmed) {
      actionGuard.release();
      return;
    }
    setActionError(null);
    setIsBusy(true);
    try {
      const half = resolveCurrentHalf(game.status);
      await createEvent(buildGameEndEvent({ gameId: game.id, half }));
      await setGameStatus(game.id, GAME_STATUS.FINAL);
      const scoreAfter = calculateScore(await listEventsByGame(game.id));
      showMessage(formatGameEndMessage({ opponentName: game.opponent, score: scoreAfter }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.');
    } finally {
      actionGuard.release();
      setIsBusy(false);
    }
  };

  const handleDeleteGame = async () => {
    const confirmed = window.confirm(
      `Spiel gegen ${game.opponent} wirklich löschen? Alle zugehörigen Events werden ebenfalls unwiderruflich gelöscht.`,
    );
    if (!confirmed) {
      return;
    }
    setActionError(null);
    setIsBusy(true);
    try {
      await deleteGame(game.id);
      navigate('/spiele');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
      setIsBusy(false);
    }
  };

  // Bearbeiten/Löschen einzelner Events (PRD §41/§42) – ausschließlich bei
  // FINAL möglich (siehe `domain/eventEditing.ts`); Steuerungs-Events sind
  // dort bereits als schreibgeschützt ausgeschlossen.
  const handleEditEvent = (event: GameEvent) => {
    if (!canEditEvent(game, event)) {
      return;
    }
    setActionError(null);
    setEditingEvent(event);
  };

  const handleEventEditSaved = () => {
    // Bewusst KEINE neue WhatsApp-Nachricht (PRD §42) – `lastMessage` bleibt
    // unverändert, nur der Bearbeiten-Flow wird geschlossen.
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (event: GameEvent) => {
    if (!canDeleteEvent(game, event) || actionGuard.isInFlight()) {
      return;
    }
    // Guard bereits vor `window.confirm()` setzen (siehe `handleFinishGame`).
    actionGuard.begin();
    const confirmed = window.confirm('Dieses Event wirklich löschen?');
    if (!confirmed) {
      actionGuard.release();
      return;
    }
    setActionError(null);
    setIsBusy(true);
    try {
      await deleteEvent(event.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
    } finally {
      actionGuard.release();
      setIsBusy(false);
    }
  };

  // Platzhalter-Klick für alle noch nicht implementierten Event-Buttons:
  // bewusst OHNE jede Persistenz/Logik (folgt in späteren Schritten).
  const handlePlaceholderEventClick = (button: LiveEventButtonConfig, teamLabel: string) => {
    setPlaceholderNotice(
      `„${button.label}" (${teamLabel}) – noch ohne Funktion, folgt in einem späteren Schritt.`,
    );
  };

  const handleEventButtonClick = (button: LiveEventButtonConfig, teamLabel: string) => {
    const touchdownTeamForButton = TOUCHDOWN_BUTTON_KEYS[button.key];
    if (touchdownTeamForButton) {
      setPlaceholderNotice(null);
      setTouchdownTeam(touchdownTeamForButton);
      return;
    }
    const conversionForButton = CONVERSION_BUTTON_KEYS[button.key];
    if (conversionForButton) {
      setPlaceholderNotice(null);
      setConversionFlow(conversionForButton);
      return;
    }
    const firstDownTeamForButton = FIRST_DOWN_BUTTON_KEYS[button.key];
    if (firstDownTeamForButton) {
      setPlaceholderNotice(null);
      setFirstDownTeam(firstDownTeamForButton);
      return;
    }
    const interceptionTeamForButton = INTERCEPTION_BUTTON_KEYS[button.key];
    if (interceptionTeamForButton) {
      setPlaceholderNotice(null);
      setInterceptionTeam(interceptionTeamForButton);
      return;
    }
    const sackTeamForButton = SACK_BUTTON_KEYS[button.key];
    if (sackTeamForButton) {
      setPlaceholderNotice(null);
      setSackTeam(sackTeamForButton);
      return;
    }
    const pickForButton = PICK_BUTTON_KEYS[button.key];
    if (pickForButton) {
      setPlaceholderNotice(null);
      setPickFlow(pickForButton);
      return;
    }
    const safetyForButton = SAFETY_BUTTON_KEYS[button.key];
    if (safetyForButton) {
      setPlaceholderNotice(null);
      setSafetyFlow(safetyForButton);
      return;
    }
    const turnoverOnDownsTeamForButton = TURNOVER_ON_DOWNS_BUTTON_KEYS[button.key];
    if (turnoverOnDownsTeamForButton) {
      setPlaceholderNotice(null);
      setTurnoverOnDownsTeam(turnoverOnDownsTeamForButton);
      return;
    }
    handlePlaceholderEventClick(button, teamLabel);
  };

  const handleCopyMessage = async () => {
    if (!lastMessage) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lastMessage);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  const eventsDisabled = !canRecordEvents(game.status);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-950 px-4 pb-24 pt-6 text-slate-50">
      <div className="flex items-center justify-between">
        <Link to="/spiele" className="text-sm text-orange-400 underline">
          ← Zurück zu Spielen
        </Link>
        <span className="text-sm text-slate-500">{formatGameDate(game.date)}</span>
      </div>

      <Scoreboard
        opponent={game.opponent}
        phoenixScore={score.phoenix}
        opponentScore={score.opponent}
      />

      <GameStatusBadge status={game.status} />

      {isFinal && (
        <p className="rounded-lg bg-slate-900 px-4 py-3 text-center text-sm text-slate-300">
          Dieses Spiel ist beendet. Es sind keine weiteren Eventaktionen mehr möglich.
        </p>
      )}

      {lastMessage && (
        <div className="flex flex-col gap-2 rounded-lg bg-slate-900 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-slate-400">
            WhatsApp-Text (manuell einfügen)
          </p>
          <p data-testid="whatsapp-message" className="whitespace-pre-line text-sm text-slate-100">
            {lastMessage}
          </p>
          <button
            type="button"
            onClick={handleCopyMessage}
            className="self-start rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
          >
            {copyState === 'copied'
              ? 'Kopiert ✓'
              : copyState === 'error'
                ? 'Kopieren fehlgeschlagen – Text manuell markieren'
                : 'Kopieren'}
          </button>
        </div>
      )}

      {placeholderNotice && (
        <p className="rounded-lg bg-slate-800 px-4 py-3 text-sm text-slate-200">
          {placeholderNotice}
        </p>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {actionError}
        </p>
      )}

      {!isFinal && (
        <>
          <EventButtonGrid
            title="Eigene Mannschaft"
            buttons={OWN_TEAM_EVENT_BUTTONS}
            disabled={eventsDisabled}
            onButtonClick={(button) => handleEventButtonClick(button, 'Regensburg Phoenix')}
          />

          <EventButtonGrid
            title="Gegner"
            buttons={OPPONENT_EVENT_BUTTONS}
            disabled={eventsDisabled}
            onButtonClick={(button) => handleEventButtonClick(button, game.opponent)}
          />

          <div className="flex flex-col gap-3 pt-2">
            {canStartHalftime(game.status) && (
              <button
                type="button"
                onClick={handleStartHalftime}
                disabled={isBusy}
                className="rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400 disabled:opacity-50"
              >
                Halbzeit
              </button>
            )}

            {canResumeSecondHalf(game.status) && (
              <button
                type="button"
                onClick={handleResumeSecondHalf}
                disabled={isBusy}
                className="rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400 disabled:opacity-50"
              >
                Weiter geht&apos;s
              </button>
            )}

            {canTriggerTwoMinuteWarning(game.status) && (
              <button
                type="button"
                onClick={handleTwoMinuteWarning}
                disabled={isBusy}
                className="rounded-xl bg-slate-800 px-4 py-4 text-lg font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                2 Minuten
              </button>
            )}

            {canFinishGame(game.status) && (
              <button
                type="button"
                onClick={handleFinishGame}
                disabled={isBusy}
                className="rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400 disabled:opacity-50"
              >
                Spielende
              </button>
            )}

            <button
              type="button"
              onClick={handleDeleteGame}
              disabled={isBusy}
              className="rounded-xl bg-red-950 px-4 py-4 text-lg font-medium text-red-300 hover:bg-red-900 disabled:opacity-50"
            >
              Spiel löschen
            </button>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase text-slate-400">Letzte Events</h2>
            <EventTicker
              entries={recentEntries}
              emptyMessage="Noch keine Events erfasst."
              canEdit={(e) => canEditEvent(game, e)}
              canDelete={(e) => canDeleteEvent(game, e)}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              isBusy={isBusy}
            />

            {tickerEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFullTicker((visible) => !visible)}
                className="self-start rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
              >
                {showFullTicker ? 'Liveticker ausblenden' : 'Vollständigen Liveticker anzeigen'}
              </button>
            )}

            {showFullTicker && (
              <>
                <h2 className="text-sm font-semibold uppercase text-slate-400">Liveticker</h2>
                <EventTicker
                  entries={tickerEntries}
                  emptyMessage="Noch keine Events erfasst."
                  canEdit={(e) => canEditEvent(game, e)}
                  canDelete={(e) => canDeleteEvent(game, e)}
                  onEdit={handleEditEvent}
                  onDelete={handleDeleteEvent}
                  isBusy={isBusy}
                />
              </>
            )}
          </section>
        </>
      )}

      {isFinal && (
        <GameTabs
          game={game}
          events={events}
          players={allPlayers}
          tickerEntries={tickerEntries}
          recentEntries={recentEntries}
          isBusy={isBusy}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onDeleteGame={handleDeleteGame}
        />
      )}

      {editingEvent && (
        <EventEditFlow
          game={game}
          event={editingEvent}
          onCancel={() => setEditingEvent(null)}
          onSaved={handleEventEditSaved}
        />
      )}

      {touchdownTeam && (
        <TouchdownFlow
          game={game}
          team={touchdownTeam}
          onCancel={() => setTouchdownTeam(null)}
          onSaved={showMessage}
        />
      )}

      {conversionFlow && (
        <ConversionFlow
          game={game}
          team={conversionFlow.team}
          conversionType={conversionFlow.conversionType}
          onCancel={() => setConversionFlow(null)}
          onSaved={showMessage}
        />
      )}

      {firstDownTeam && (
        <FirstDownFlow
          game={game}
          team={firstDownTeam}
          onCancel={() => setFirstDownTeam(null)}
          onSaved={showMessage}
        />
      )}

      {interceptionTeam && (
        <InterceptionFlow
          game={game}
          team={interceptionTeam}
          onCancel={() => setInterceptionTeam(null)}
          onSaved={showMessage}
        />
      )}

      {sackTeam && (
        <SackFlow
          game={game}
          team={sackTeam}
          onCancel={() => setSackTeam(null)}
          onSaved={showMessage}
        />
      )}

      {pickFlow && (
        <PickFlow
          game={game}
          team={pickFlow.team}
          variant={pickFlow.variant}
          onCancel={() => setPickFlow(null)}
          onSaved={showMessage}
        />
      )}

      {safetyFlow && (
        <SafetyFlow
          game={game}
          team={safetyFlow.team}
          variant={safetyFlow.variant}
          onCancel={() => setSafetyFlow(null)}
          onSaved={showMessage}
        />
      )}

      {turnoverOnDownsTeam && (
        <TurnoverOnDownsFlow
          game={game}
          team={turnoverOnDownsTeam}
          onCancel={() => setTurnoverOnDownsTeam(null)}
          onSaved={showMessage}
        />
      )}
    </div>
  );
}
