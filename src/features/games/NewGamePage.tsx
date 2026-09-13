import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createGame } from '../../data/games';
import { validateGameInput, type GameValidationErrors } from '../../domain/gameValidation';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formular für ein neues Spiel (PRD §12). Regensburg Phoenix ist automatisch
 * das eigene Team; nur der Gegner muss eingegeben werden. Das Datum wird mit
 * dem heutigen Tag vorbefüllt (bearbeitbar), damit auch ein für später
 * geplantes Spieldatum erfasst werden kann.
 */
export function NewGamePage() {
  const navigate = useNavigate();
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState<string>(() => todayIsoDate());
  const [errors, setErrors] = useState<GameValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const validationErrors = validateGameInput({ opponent, date });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const game = await createGame({ opponent, date });
      navigate(`/spiele/${game.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-950 px-4 pb-24 pt-6 text-slate-50">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Neues Spiel</h1>
        <p className="text-sm text-slate-400">Regensburg Phoenix (Heimteam)</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="opponent" className="text-sm font-medium text-slate-300">
            Gegner
          </label>
          <input
            id="opponent"
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            className="rounded-lg bg-slate-900 px-4 py-3 text-lg text-slate-50 outline-none ring-1 ring-slate-700 focus:ring-orange-500"
            autoComplete="off"
          />
          {errors.opponent && <p className="text-sm text-red-400">{errors.opponent}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-sm font-medium text-slate-300">
            Datum
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-slate-900 px-4 py-3 text-lg text-slate-50 outline-none ring-1 ring-slate-700 focus:ring-orange-500"
          />
          {errors.date && <p className="text-sm text-red-400">{errors.date}</p>}
        </div>

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
            Spiel starten
          </button>
          <Link
            to="/spiele"
            className="rounded-xl bg-slate-800 px-4 py-4 text-center text-lg font-medium hover:bg-slate-700"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
