import { useRef } from 'react';

/**
 * Synchroner Schutz gegen doppelte Ausführung einer asynchronen Aktion durch
 * zwei echt überlappende Klicks (z. B. `fireEvent.click()` zweimal ohne
 * `await` dazwischen). Ein `useState`-Flag (z. B. `isBusy`/`isSaving`, das
 * weiterhin die UI steuert – deaktivierte Buttons, Ladeanzeige) reicht dafür
 * NICHT aus: React-State-Updates werden erst beim nächsten Render sichtbar,
 * ein `useRef`-Wert dagegen sofort. Ein zweiter, wirklich überlappender Klick
 * sieht dadurch garantiert bereits `isInFlight() === true` und wird
 * ignoriert, noch bevor überhaupt neuer State gesetzt wird.
 *
 * Ursprünglich als lokaler `actionInFlightRef` in `GameDetailPage.tsx` für
 * die Spielablauf-Aktionen (Halbzeit/"Weiter geht's"/2-Minuten-Warnung/
 * Spielende) sowie das Event-Löschen eingeführt; hier als gemeinsamer
 * Baustein extrahiert, damit sowohl `GameDetailPage.tsx` als auch die
 * einzelnen Event-Erfassungs-Flows (Touchdown, Conversion, First Down,
 * Interception, Pick 6/2, Sack, Safety/1-Punkt-Safety) denselben Schutz ohne
 * Code-Duplikation nutzen.
 */
export function useActionGuard() {
  const inFlightRef = useRef(false);

  /** Ob gerade eine Aktion dieses Guards läuft. */
  const isInFlight = () => inFlightRef.current;

  /**
   * Markiert synchron den Start einer Aktion. Muss von einem passenden
   * späteren `release()` gefolgt werden (z. B. in einem `finally`-Block,
   * oder sofort, falls ein dazwischenliegender Bestätigungsdialog
   * abgebrochen wird) – für Fälle, in denen zwischen Guard und eigentlicher
   * Aktion noch etwas anderes passiert (z. B. `window.confirm(...)`) und
   * `run()` deshalb nicht passt.
   */
  const begin = () => {
    inFlightRef.current = true;
  };

  /** Gibt den Guard wieder frei. */
  const release = () => {
    inFlightRef.current = false;
  };

  /**
   * Führt `action` nur aus, wenn gerade keine andere Aktion dieses Guards
   * läuft. Setzt den Guard synchron VOR jedem `await` innerhalb von `action`,
   * damit ein zweiter, wirklich überlappender Aufruf ihn bereits gesetzt
   * sieht, und gibt ihn danach garantiert wieder frei (auch bei einem
   * Fehler) – der einfache Fall ohne dazwischenliegenden Dialog.
   */
  const run = async (action: () => Promise<void>) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      await action();
    } finally {
      inFlightRef.current = false;
    }
  };

  return { isInFlight, begin, release, run };
}
