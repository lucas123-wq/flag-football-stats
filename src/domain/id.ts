/** Erzeugt eine neue eindeutige ID für lokal gespeicherte Entitäten. */
export function createId(): string {
  return crypto.randomUUID();
}
