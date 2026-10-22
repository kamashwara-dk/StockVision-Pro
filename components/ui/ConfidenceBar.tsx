import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  score: number       // 0–100
  className?: string
  /** Label shown above the bar. Defaults to "Directional accuracy". */
  label?: string
}

export function ConfidenceBar({ score, className, label = "Directional accuracy" }: ConfidenceBarProps) {
  let colorClass = "bg-[var(--positive)]"
  if (score < 50) colorClass = "bg-[var(--negative)]"
  else if (score < 75) colorClass = "bg-[var(--warning)]"

  return (
    <div className={cn("flex flex-col space-y-1.5 w-full", className)}>
      <div className="flex justify-between text-xs font-medium">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-primary)]">{score.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", colorClass)}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  )
}
