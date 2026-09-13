import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
}

/** PRD §10: exakte Bereiche/Reihenfolge. */
const NAV_ITEMS: NavItem[] = [
  { to: '/spiele', label: 'Spiele' },
  { to: '/spieler', label: 'Spieler' },
  { to: '/einstellungen', label: 'Einstellungen' },
];

/**
 * Persistente Hauptnavigation (PRD §10): auf jeder Seite über eine feste
 * Bottom-Navigationsleiste erreichbar (mobile-first, große Touch-Ziele).
 *
 * `NavLink` aus dem bereits verwendeten `react-router-dom` markiert den
 * aktiven Bereich automatisch – ohne `end`-Prop vergleicht es standardmäßig
 * präfixbasiert, sodass z. B. `/spiele/:gameId` oder `/spieler/neu` den
 * jeweiligen Hauptbereich ebenfalls als aktiv anzeigen. Keine eigene/zweite
 * Aktiv-Logik nötig.
 */
export function MainNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      // `pb-[env(safe-area-inset-bottom)]`: index.html setzt `viewport-fit=cover`
      // (nötig, damit die installierte PWA im Standalone-Modus den vollen
      // Bildschirm inkl. Notch/Home-Indicator-Bereich nutzt) – jedes am
      // Bildschirmrand fixierte Element muss dieses Inset selbst kompensieren,
      // sonst rückt die Navigation auf iPhones mit Home-Indicator zu nah an
      // dessen Wischbereich heran. Ohne Safe Area (Desktop, ältere Geräte)
      // wertet `env(...)` zu 0 aus – keine Verhaltensänderung dort.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-sm font-semibold ${
                isActive ? 'text-orange-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
