import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Zeigt einen dezenten Hinweis an, sobald die App offline-bereit ist
 * oder ein Update im Hintergrund geladen wurde.
 *
 * Enthält bewusst noch keine fachliche Logik – dient in diesem Schritt
 * nur dem Nachweis, dass die Service-Worker-/Offline-Grundlage funktioniert.
 */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log('Service Worker registriert:', swUrl);
    },
    onRegisterError(error) {
      console.error('Service Worker Registrierung fehlgeschlagen:', error);
    },
  });

  if (!offlineReady && !needRefresh) {
    return null;
  }

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    // `bottom-[calc(4rem+env(safe-area-inset-bottom))]` statt `bottom-0`: die
    // persistente Hauptnavigation (`MainNav`, PRD §10) belegt den unteren
    // Bildschirmrand – dieser Hinweis sitzt darüber, damit sich beide
    // fixierten Elemente nicht überlappen. Der `env(...)`-Anteil hält den
    // Abstand auch dann korrekt, wenn `MainNav` durch ein
    // Safe-Area-Inset (Home-Indicator) höher wird, als die feste 4rem-Basis
    // allein abdecken würde (wertet auf Geräten ohne Safe Area zu 0 aus).
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 flex justify-center p-4">
      <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-4 py-3 text-sm text-slate-50 shadow-lg">
        <span>{needRefresh ? 'Update verfügbar.' : 'App ist offline-bereit.'}</span>
        {needRefresh && (
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="rounded bg-orange-500 px-3 py-1 font-medium text-slate-950 hover:bg-orange-400"
          >
            Aktualisieren
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Hinweis schließen"
          className="text-slate-400 hover:text-slate-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
