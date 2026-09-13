import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistentStorage';

/**
 * `navigator.storage` existiert in jsdom (der Testumgebung dieses Projekts)
 * nicht von Haus aus – jeder Testfall setzt daher gezielt den benötigten
 * Zustand über `Object.defineProperty` und macht ihn danach wieder rückgängig,
 * damit sich Tests nicht gegenseitig beeinflussen.
 */
const originalStorage = (navigator as unknown as { storage?: StorageManager }).storage;

afterEach(() => {
  Object.defineProperty(navigator, 'storage', {
    value: originalStorage,
    configurable: true,
  });
});

function stubStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', {
    value,
    configurable: true,
  });
}

describe('requestPersistentStorage', () => {
  it('gibt true zurück und ruft persist() auf, wenn der Browser persistenten Speicher gewährt', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist });

    const result = await requestPersistentStorage();

    expect(result).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('gibt false zurück, wenn der Browser persist() ablehnt (gültiger, kein Fehlerfall)', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    stubStorage({ persist });

    const result = await requestPersistentStorage();

    expect(result).toBe(false);
  });

  it('gibt false zurück, ohne zu werfen, wenn navigator.storage nicht existiert (Feature Detection)', async () => {
    stubStorage(undefined);

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('gibt false zurück, ohne zu werfen, wenn navigator.storage.persist nicht existiert (Feature Detection)', async () => {
    stubStorage({});

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('gibt false zurück, ohne zu werfen, wenn persist() fehlschlägt (z. B. eingeschränkter/privater Modus)', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('Simulierter Fehler'));
    stubStorage({ persist });

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('funktioniert unabhängig vom Ausgang mehrfach hintereinander (keine unerwartete Zustandsänderung)', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist });

    await requestPersistentStorage();
    await requestPersistentStorage();

    expect(persist).toHaveBeenCalledTimes(2);
  });
});
