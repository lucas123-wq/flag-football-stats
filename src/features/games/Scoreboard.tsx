interface ScoreboardProps {
  opponent: string;
  /**
   * Aktueller Spielstand. In diesem Schritt ausschließlich zur Anzeige –
   * keine Berechnung hier. Der Aufrufer übergibt vorerst `0`/`0` (siehe
   * `GameDetailPage`); die spätere Score-Engine leitet diese Werte aus den
   * Events ab (PRD §35, Single Source of Truth).
   */
  phoenixScore: number;
  opponentScore: number;
}

/** Zeigt Teamnamen und aktuellen Spielstand (PRD §14). */
export function Scoreboard({ opponent, phoenixScore, opponentScore }: ScoreboardProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900 px-4 py-6 text-center">
      <p className="text-base font-semibold">Regensburg Phoenix</p>
      <p className="text-5xl font-bold tabular-nums">
        {phoenixScore} : {opponentScore}
      </p>
      <p className="text-base font-semibold">{opponent}</p>
    </div>
  );
}
