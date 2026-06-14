import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "positive" | "negative" | "warning" | "outline"
  shape?: "pill" | "square"
}

export function Badge({ 
  className, 
  variant = "default", 
  shape = "pill",
  ...props 
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center text-[11px] font-medium tracking-wide uppercase px-2.5 py-0.5",
        shape === "pill" ? "rounded-full" : "rounded",
        {
          "bg-[var(--accent-dim)] text-[var(--accent)]": variant === "default",
          "bg-[rgba(0,229,160,0.12)] text-[var(--positive)]": variant === "positive",
          "bg-[rgba(255,90,90,0.12)] text-[var(--negative)]": variant === "negative",
          "bg-[rgba(255,200,0,0.12)] text-[var(--warning)]": variant === "warning",
          "border border-[var(--border)] text-[var(--text-secondary)] bg-transparent": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}
