/**
 * Deklarative Liste der Event-Buttons für den Live-Spielbildschirm.
 *
 * WICHTIG: Dies ist in Schritt 5 bewusst NUR Anzeige-Metadaten (Label). Es
 * gibt noch keine Verknüpfung zu `EVENT_TYPE`, keinen Event-Flow und keine
 * Punktelogik – die Buttons sind reine UI-Platzhalter. Die Zuordnung zu
 * konkreten `EVENT_TYPE`-Werten (inkl. Rushing/Passing-Unterscheidung beim
 * eigenen Touchdown, Spieler-/QB-/Receiver-Auswahl usw.) folgt in Schritt 6.
 *
 * Die Gegner-Liste spiegelt die Eigene-Mannschaft-Liste 1:1: Das bestehende
 * `EVENT_TYPE`-Modell (siehe `domain/types.ts`, PRD §18–§26) sieht für jeden
 * dieser Eventtypen bereits ein `team`-Feld (`PHOENIX` | `OPPONENT`) vor –
 * nur der Touchdown unterscheidet sich (`TOUCHDOWN_RUSHING`/`TOUCHDOWN_PASSING`
 * beim eigenen Team vs. der generische `TOUCHDOWN_OPPONENT`), was aber für
 * diese reine Label-Liste keinen Unterschied macht.
 */
export interface LiveEventButtonConfig {
  /** Stabiler Schlüssel für Rendering/Tests. */
  key: string;
  label: string;
}

export const OWN_TEAM_EVENT_BUTTONS: LiveEventButtonConfig[] = [
  { key: 'touchdown', label: 'Touchdown' },
  { key: 'conversion-1pt', label: '1-Punkt-Conversion' },
  { key: 'conversion-2pt', label: '2-Punkt-Conversion' },
  { key: 'first-down', label: 'First Down' },
  { key: 'interception', label: 'Interception' },
  { key: 'pick-6', label: 'Pick 6' },
  { key: 'pick-2', label: 'Pick 2' },
  { key: 'sack', label: 'Sack' },
  { key: 'safety', label: 'Safety' },
  { key: 'safety-1pt', label: '1-Punkt-Safety' },
  { key: 'turnover-on-downs', label: 'Turnover on Downs' },
];

export const OPPONENT_EVENT_BUTTONS: LiveEventButtonConfig[] = [
  { key: 'opponent-touchdown', label: 'Touchdown' },
  { key: 'opponent-conversion-1pt', label: '1-Punkt-Conversion' },
  { key: 'opponent-conversion-2pt', label: '2-Punkt-Conversion' },
  { key: 'opponent-first-down', label: 'First Down' },
  { key: 'opponent-interception', label: 'Interception' },
  { key: 'opponent-pick-6', label: 'Pick 6' },
  { key: 'opponent-pick-2', label: 'Pick 2' },
  { key: 'opponent-sack', label: 'Sack' },
  { key: 'opponent-safety', label: 'Safety' },
  { key: 'opponent-safety-1pt', label: '1-Punkt-Safety' },
  { key: 'opponent-turnover-on-downs', label: 'Turnover on Downs' },
];
