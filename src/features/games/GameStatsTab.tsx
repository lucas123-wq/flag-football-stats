import { calculatePlayerStats, getParticipantPlayerIds } from '../../domain/stats';
import type { PlayerGameStats } from '../../domain/stats';
import { calculateTeamStats } from '../../domain/teamStats';
import type { TeamStats } from '../../domain/teamStats';
import { formatPlayerLabel } from '../../domain/touchdown';
import type { GameEvent, Player } from '../../domain/types';

interface GameStatsTabProps {
  events: GameEvent[];
  players: Player[];
  opponentName: string;
}

/**
 * Statistik-Zeilen gemäß PRD §40, exakte Reihenfolge/Beschriftung
 * übernommen. Einzige Ergänzung: "Passing TD" fehlt im §40-Beispiel (dort
 * nur Rushing/Receiving TD gelistet), ist aber in §34 als eigene
 * Statistik-Kategorie definiert und in `calculatePlayerStats()` bereits
 * vollständig erfasst – wird hier direkt nach Rushing TD ergänzt, damit ein
 * werfender Spieler nicht mit einer unvollständigen Statistikzeile
 * angezeigt wird. Siehe Abschlussbericht für diese Abweichung.
 */
const STAT_ROWS: { key: keyof PlayerGameStats; label: string }[] = [
  { key: 'rushingTouchdowns', label: 'Rushing TD' },
  { key: 'passingTouchdowns', label: 'Passing TD' },
  { key: 'receivingTouchdowns', label: 'Receiving TD' },
  { key: 'firstDowns', label: 'First Downs' },
  { key: 'onePointConversions', label: '1 Pt Conversions' },
  { key: 'twoPointConversions', label: '2 Pt Conversions' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'pickSixes', label: 'Pick 6' },
  { key: 'pickTwos', label: 'Pick 2' },
  { key: 'sacks', label: 'Sacks' },
  { key: 'safeties', label: 'Safeties' },
  { key: 'onePointSafeties', label: '1 Pt Safeties' },
];

/** Team-Gesamtstatistik-Zeilen (Erweiterung, siehe `domain/teamStats.ts`). */
const TEAM_STAT_ROWS: { key: keyof TeamStats; label: string }[] = [
  { key: 'touchdowns', label: 'Touchdowns' },
  { key: 'onePointConversions', label: '1-Pt Conversions' },
  { key: 'twoPointConversions', label: '2-Pt Conversions' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'turnoverOnDowns', label: 'Turnover on Downs' },
];

interface TeamStatCardProps {
  title: string;
  stats: TeamStats;
}

/** Eine Team-Statistik-Karte, optisch identisch zu den Spieler-Statistik-Karten unten. */
function TeamStatCard({ title, stats }: TeamStatCardProps) {
  return (
    <div className="rounded-lg bg-slate-900 px-4 py-3">
      <p className="mb-2 text-base font-semibold">{title}</p>
      <dl className="flex flex-col gap-1 text-sm">
        {TEAM_STAT_ROWS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <dt className="text-slate-300">{label}</dt>
            <dd className="tabular-nums text-slate-100">{stats[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Statistiken eines Spiels (PRD §40 + Team-Gesamtstatistik-Erweiterung).
 * Verwendet ausschließlich die bestehende Domain-Berechnung
 * `calculatePlayerStats()`/`calculateTeamStats()` – keine zweite/parallele
 * Statistiklogik in der UI.
 *
 * Zeigt zuerst die "Teamstatistik" (beide Teams, immer sichtbar – auch bei
 * 0 Events/0-Werten, da Nullwerte hier laut Anforderung nicht ausgeblendet
 * werden), danach unverändert die bestehenden Spielerstatistiken. Gezeigt
 * werden nur Spieler, die in DIESEM Spiel tatsächlich als Scorer/QB/Receiver
 * auftauchen (`getParticipantPlayerIds`), unabhängig vom aktuellen
 * aktiv/inaktiv-Status (PRD §9.2: auch später deaktivierte Spieler bleiben
 * in historischen Spielen sichtbar). Nullwerte werden laut PRD ausdrücklich
 * NICHT ausgeblendet (§40: "dürfen", nicht "müssen" – das PRD-Beispiel
 * selbst zeigt mehrere 0-Werte).
 */
export function GameStatsTab({ events, players, opponentName }: GameStatsTabProps) {
  const teamStats = calculateTeamStats(events);

  const playerById = new Map(players.map((player) => [player.id, player]));
  const participants = getParticipantPlayerIds(events)
    .map((id) => playerById.get(id))
    .filter((player): player is Player => Boolean(player))
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase text-slate-400">Teamstatistik</h2>
        <div className="flex flex-col gap-3">
          <TeamStatCard title="Regensburg Phoenix" stats={teamStats.phoenix} />
          <TeamStatCard title={opponentName} stats={teamStats.opponent} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {participants.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Spielerstatistiken vorhanden.</p>
        ) : (
          participants.map((player) => {
            const stats = calculatePlayerStats(events, player.id);
            return (
              <div key={player.id} className="rounded-lg bg-slate-900 px-4 py-3">
                <p className="mb-2 text-base font-semibold">{formatPlayerLabel(player)}</p>
                <dl className="flex flex-col gap-1 text-sm">
                  {STAT_ROWS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <dt className="text-slate-300">{label}</dt>
                      <dd className="tabular-nums text-slate-100">{stats[key]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
