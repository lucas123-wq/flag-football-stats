import { useId } from 'react';
import type { LiveEventButtonConfig } from './liveEventButtons';

interface EventButtonGridProps {
  title: string;
  buttons: LiveEventButtonConfig[];
  /** z. B. `true`, wenn das Spiel bereits `FINAL` ist. */
  disabled: boolean;
  onButtonClick: (button: LiveEventButtonConfig) => void;
}

/**
 * Rein visuelles Raster großer Event-Buttons. Speichert NICHTS – der Klick
 * wird ausschließlich über `onButtonClick` nach außen gereicht, die
 * tatsächliche Event-Logik entsteht erst in Schritt 6.
 */
export function EventButtonGrid({ title, buttons, disabled, onButtonClick }: EventButtonGridProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-sm font-semibold uppercase text-slate-400">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {buttons.map((button) => (
          <button
            key={button.key}
            type="button"
            disabled={disabled}
            onClick={() => onButtonClick(button)}
            className="rounded-xl bg-slate-800 px-3 py-5 text-base font-semibold leading-tight text-slate-50 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800"
          >
            {button.label}
          </button>
        ))}
      </div>
    </section>
  );
}
