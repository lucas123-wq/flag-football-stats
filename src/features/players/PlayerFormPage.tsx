import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../data/db';
import { createPlayer, updatePlayer } from '../../data/players';
import {
  JERSEY_NUMBER_MAX,
  JERSEY_NUMBER_MIN,
  validatePlayerInput,
  type PlayerValidationErrors,
} from '../../domain/playerValidation';
import type { Player } from '../../domain/types';

interface FormState {
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  active: boolean;
}

/** Ergebnis der Suche nach dem zu bearbeitenden Spieler (unterscheidet "lädt noch" von "nicht gefunden"). */
type EditLookup = { mode: 'create' } | { mode: 'edit'; player: Player } | { mode: 'not-found' };

function toFormState(player?: Player): FormState {
  return {
    firstName: player?.firstName ?? '',
    lastName: player?.lastName ?? '',
    jerseyNumber: player ? String(player.jerseyNumber) : '',
    active: player?.active ?? true,
  };
}

/** Parst das Trikotnummer-Textfeld; leer oder nicht-numerisch ergibt `NaN`. */
function parseJerseyNumber(raw: string): number {
  if (raw.trim() === '') {
    return Number.NaN;
  }
  return Number(raw);
}

/**
 * Ermittelt den Bearbeitungskontext über eine Live-Query. Läuft die Anfrage
 * noch, liefert `useLiveQuery` `undefined` – erst danach steht fest, ob der
 * Spieler existiert. Das vermeidet ein separates "isInitialized"-Flag, das
 * sonst per Effekt gesetzt werden müsste.
 */
function useEditLookup(playerId: string | undefined): EditLookup | undefined {
  return useLiveQuery(async (): Promise<EditLookup> => {
    if (!playerId) {
      return { mode: 'create' };
    }
    const player = await db.players.get(playerId);
    return player ? { mode: 'edit', player } : { mode: 'not-found' };
  }, [playerId]);
}

/**
 * Formular zum Anlegen (`/spieler/neu`) und Bearbeiten
 * (`/spieler/:playerId/bearbeiten`) eines Spielers (PRD §44).
 */
export function PlayerFormPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const lookup = useEditLookup(playerId);

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
          Spieler wurde nicht gefunden.
        </p>
        <Link to="/spieler" className="text-orange-400 underline">
          Zurück zur Spielerliste
        </Link>
      </div>
    );
  }

  // `key` sorgt für einen frischen Formular-Zustand, sobald ein anderer (oder
  // erstmals ein) Spieler geladen ist – ohne einen zusätzlichen Effekt.
  return (
    <PlayerForm
      key={lookup.mode === 'edit' ? lookup.player.id : 'new'}
      existingPlayer={lookup.mode === 'edit' ? lookup.player : undefined}
    />
  );
}

function PlayerForm({ existingPlayer }: { existingPlayer: Player | undefined }) {
  const navigate = useNavigate();
  const allPlayers = useLiveQuery(() => db.players.toArray(), []) ?? [];

  const [form, setForm] = useState<FormState>(() => toFormState(existingPlayer));
  const [errors, setErrors] = useState<PlayerValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = Boolean(existingPlayer);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const candidate = {
      firstName: form.firstName,
      lastName: form.lastName,
      jerseyNumber: parseJerseyNumber(form.jerseyNumber),
      active: form.active,
    };
    const validationErrors = validatePlayerInput(candidate, {
      existingPlayers: allPlayers,
      excludePlayerId: existingPlayer?.id,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (existingPlayer) {
        await updatePlayer(existingPlayer.id, candidate);
      } else {
        await createPlayer(candidate);
      }
      navigate('/spieler');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-950 px-4 pb-24 pt-6 text-slate-50">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {isEditMode ? 'Spieler bearbeiten' : 'Spieler hinzufügen'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="firstName" className="text-sm font-medium text-slate-300">
            Vorname
          </label>
          <input
            id="firstName"
            type="text"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            className="rounded-lg bg-slate-900 px-4 py-3 text-lg text-slate-50 outline-none ring-1 ring-slate-700 focus:ring-orange-500"
            autoComplete="off"
          />
          {errors.firstName && <p className="text-sm text-red-400">{errors.firstName}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="lastName" className="text-sm font-medium text-slate-300">
            Nachname
          </label>
          <input
            id="lastName"
            type="text"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            className="rounded-lg bg-slate-900 px-4 py-3 text-lg text-slate-50 outline-none ring-1 ring-slate-700 focus:ring-orange-500"
            autoComplete="off"
          />
          {errors.lastName && <p className="text-sm text-red-400">{errors.lastName}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="jerseyNumber" className="text-sm font-medium text-slate-300">
            Trikotnummer
          </label>
          <input
            id="jerseyNumber"
            type="number"
            inputMode="numeric"
            min={JERSEY_NUMBER_MIN}
            max={JERSEY_NUMBER_MAX}
            value={form.jerseyNumber}
            onChange={(e) => setForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
            className="rounded-lg bg-slate-900 px-4 py-3 text-lg text-slate-50 outline-none ring-1 ring-slate-700 focus:ring-orange-500"
          />
          {errors.jerseyNumber && <p className="text-sm text-red-400">{errors.jerseyNumber}</p>}
        </div>

        <label className="flex items-center gap-3 text-base">
          <input
            id="active"
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="h-6 w-6 rounded accent-orange-500"
          />
          Aktiv
        </label>

        {formError && (
          <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-orange-500 px-4 py-4 text-lg font-semibold text-slate-950 active:bg-orange-400 disabled:opacity-50"
          >
            Speichern
          </button>
          <Link
            to="/spieler"
            className="rounded-xl bg-slate-800 px-4 py-4 text-center text-lg font-medium hover:bg-slate-700"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
