"use client";
// Thin left sidebar used on detail pages (stock/[symbol])
// On the main dashboard the floating navbar is used instead.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Cpu,
  Globe,
  ChevronLeft,
} from "lucide-react";

const NAV = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
  { label: "Predictions", href: "/dashboard/predictions", icon: Cpu },
  { label: "Markets", href: "/dashboard/markets", icon: Globe },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col py-8 px-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mb-10 px-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-lg font-bold text-white tracking-tight">StockVision</span>
      </Link>

      {/* Back */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors mb-6 px-2"
      >
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[rgba(0,229,160,0.1)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
