/**
 * Fordert beim Browser persistenten Speicher an (`navigator.storage.persist()`).
 *
 * Reine Risikominderung, keine PRD-Pflichtanforderung: Da die App
 * ausschließlich lokal über IndexedDB speichert (PRD §4/§54, Priorität 1
 * "Datenintegrität"), senkt ein gewährter "persistent storage mode" das
 * Risiko, dass der Browser die Datenbank unter Speicherdruck automatisch
 * räumt. Die App MUSS aber in jedem Fall auch funktionieren, wenn der
 * Browser dies ablehnt, `navigator.storage`/`persist()` gar nicht kennt,
 * oder die Anfrage aus irgendeinem Grund fehlschlägt – all das wird hier
 * bewusst nur best-effort und ohne jede UI-Kopplung behandelt:
 *
 * - Feature Detection: fehlt `navigator.storage` oder `persist()`, wird
 *   sauber nichts getan (kein Fehler, kein Log, keine Exception).
 * - Ein abgelehntes `persist()` (Rückgabewert `false`) ist ein normaler,
 *   gültiger Ausgang – keine Fehlerbehandlung nötig.
 * - Ein tatsächlicher Fehler (z. B. in privatem/eingeschränktem Modus)
 *   wird abgefangen, statt die App zu beeinträchtigen.
 *
 * Aufruf einmalig beim App-Start (siehe `main.tsx`), nicht wiederholt bei
 * jedem Render – ein erneuter Aufruf wäre zwar unschädlich (der Browser
 * beantwortet ihn wie jede andere Anfrage), aber unnötig.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }
    return await navigator.storage.persist();
  } catch {
    // Ein Fehler bei der Anfrage darf die App niemals beeinträchtigen –
    // IndexedDB funktioniert unabhängig davon unverändert weiter.
    return false;
  }
}
