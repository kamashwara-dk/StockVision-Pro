"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Briefcase, Cpu, Globe, Settings, LogOut, ChevronDown, Menu, X } from "lucide-react"
import { usePortfolio, AVAILABLE_CURRENCIES } from "@/components/providers/PortfolioProvider"
import { useState } from "react"

export function DashboardNavbar({ userName = 'Admin' }: { userName?: string }) {
  const pathname = usePathname()
  const { currency, setCurrency } = usePortfolio()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
    { name: "Predictions", href: "/dashboard/predictions", icon: Cpu },
    { name: "Markets", href: "/dashboard/markets", icon: Globe },
  ]

  return (
    <>
      {/* Fixed navbar bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 pb-2 bg-[#0A0F1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-base font-bold tracking-tight text-white">StockVision</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ name, href, icon: Icon }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={name}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[rgba(0,229,160,0.12)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {name}
                </Link>
              )
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Currency selector */}
            <div className="relative hidden sm:block">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="appearance-none bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)] rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
              >
                {AVAILABLE_CURRENCIES.map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
            </div>

            {/* User badge */}
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
              <div className="w-7 h-7 rounded-full bg-[#0A0F1E] border border-white/10 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-bold text-white">{userName}</span>
                <span className="text-[10px] text-[var(--accent)]">Pro</span>
              </div>
            </div>

            <button className="hidden sm:block text-[var(--text-secondary)] hover:text-white transition-colors p-1">
              <Settings className="w-4 h-4" />
            </button>

            <form action="/auth/signout" method="post">
              <button type="submit" className="hidden sm:block text-[var(--text-secondary)] hover:text-[#FF5A5A] transition-colors p-1">
                <LogOut className="w-4 h-4" />
              </button>
            </form>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-[var(--text-secondary)] hover:text-white transition-colors p-1"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div className="md:hidden mt-3 pb-3 border-t border-white/5 pt-3 flex flex-col gap-1">
            {navItems.map(({ name, href, icon: Icon }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={name}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[rgba(0,229,160,0.12)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {name}
                </Link>
              )
            })}
            <div className="flex items-center gap-3 px-3 pt-3 mt-1 border-t border-white/5">
              <div className="relative flex-1">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full appearance-none bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold uppercase focus:outline-none"
                >
                  {AVAILABLE_CURRENCIES.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
              </div>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-[var(--text-secondary)] hover:text-[#FF5A5A] transition-colors p-1">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
