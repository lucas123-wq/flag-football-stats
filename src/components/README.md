# components

Wiederverwendbare, fachlich neutrale UI-Bausteine (Button, ConfirmDialog, Tabs, MessagePreview,
ClipboardFallback usw.), die von mehreren `features` genutzt werden.

- `MainNav.tsx` – Persistente Hauptnavigation (PRD §10: SPIELE/SPIELER/EINSTELLUNGEN), einmalig in
  `App.tsx` außerhalb von `<Routes>` gerendert (feste Bottom-Leiste, mobile-first). Nutzt
  `react-router-dom`s `NavLink` für die aktive-Bereich-Markierung (`aria-current="page"`) – keine
  eigene Aktiv-Logik. Ohne `end`-Prop matcht `NavLink` präfixbasiert, sodass Unterseiten wie
  `/spiele/:gameId` oder `/spieler/neu` den jeweiligen Hauptbereich ebenfalls als aktiv zeigen.
