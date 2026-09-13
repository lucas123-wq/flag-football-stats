import { Navigate, Route, Routes } from 'react-router-dom';
import { MainNav } from './components/MainNav';
import { GameDetailPage } from './features/games/GameDetailPage';
import { GamesListPage } from './features/games/GamesListPage';
import { NewGamePage } from './features/games/NewGamePage';
import { PlayerFormPage } from './features/players/PlayerFormPage';
import { PlayersListPage } from './features/players/PlayersListPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { PwaStatus } from './pwa/PwaStatus';

/**
 * "/" leitet auf die Spiele-Startseite weiter (PRD §10: "Spiele" ist die
 * Startseite der drei Hauptbereiche) – unverändert seit Schritt 1.
 *
 * `MainNav` (PRD §10) wird wie `PwaStatus` einmalig außerhalb von `<Routes>`
 * gerendert, damit die Hauptnavigation auf jeder Seite konsistent erreichbar
 * ist, ohne jede einzelne Seite einzeln zu verändern.
 */
function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/spiele" replace />} />
        <Route path="/spiele" element={<GamesListPage />} />
        <Route path="/spiele/neu" element={<NewGamePage />} />
        <Route path="/spiele/:gameId" element={<GameDetailPage />} />
        <Route path="/spieler" element={<PlayersListPage />} />
        <Route path="/spieler/neu" element={<PlayerFormPage />} />
        <Route path="/spieler/:playerId/bearbeiten" element={<PlayerFormPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/spiele" replace />} />
      </Routes>
      <MainNav />
      <PwaStatus />
    </>
  );
}

export default App;
