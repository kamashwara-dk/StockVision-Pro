import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  change?: {
    value: string
    isPositive: boolean
  }
  className?: string
}

export function StatCard({ label, value, change, className }: StatCardProps) {
  return (
    <div className={cn("bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col", className)}>
      <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-2">{label}</h3>
      <div className="flex items-end justify-between mt-auto">
        <div className="text-3xl font-bold text-[var(--text-primary)]">{value}</div>
        {change && (
          <div className={cn(
            "flex items-center text-sm font-medium px-2 py-1 rounded-md",
            change.isPositive ? "text-[var(--positive)] bg-[rgba(0,229,160,0.1)]" : "text-[var(--negative)] bg-[rgba(255,90,90,0.1)]"
          )}>
            {change.isPositive ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
            {change.value}
          </div>
        )}
      </div>
    </div>
  )
}
