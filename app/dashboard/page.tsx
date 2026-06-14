import { StatsRow } from "@/components/dashboard/StatsRow";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";

export default function DashboardPage() {
  return (
    <div className="pb-12">
      <header id="overview" className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-4">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            Live Portfolio
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Portfolio Overview
        </h1>
        <p className="text-[var(--text-secondary)]">
          Real-time prices · Predictions powered by ML
        </p>
      </header>

      <StatsRow />
      <HoldingsTable />
    </div>
  );
}
