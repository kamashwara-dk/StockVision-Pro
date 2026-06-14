import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  showPulse?: boolean
  className?: string
}

export function SectionHeader({ title, showPulse = false, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center space-x-3 mb-6", className)}>
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
      {showPulse && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]"></span>
        </span>
      )}
    </div>
  )
}
