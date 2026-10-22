import { AIPredictions } from "@/components/dashboard/AIPredictions"

export default function PredictionsPage() {
  return (
    <div className="pb-12">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-4">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">AI Engine</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">AI Predictions</h1>
        <p className="text-[var(--text-secondary)]">
          ML-powered price forecasts · day-by-day date table · any ticker
        </p>
      </header>
      <AIPredictions />
    </div>
  )
}
