import { ScenarioPanel } from "@/components/dashboard/ScenarioPanel"
import { HoldingsTable } from "@/components/dashboard/HoldingsTable"
import { MarketOverview } from "@/components/dashboard/MarketOverview"

export default function MarketsPage() {
  return (
    <div className="pb-12">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-4">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Live Markets</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Markets</h1>
        <p className="text-[var(--text-secondary)]">
          Indian &amp; global indices · scenario analysis · your holdings
        </p>
      </header>

      {/* Indian + Global market overview */}
      <MarketOverview />

      {/* World event scenario analysis */}
      <ScenarioPanel />

      {/* Holdings table */}
      <div className="mt-8">
        <HoldingsTable />
      </div>
    </div>
  )
}
