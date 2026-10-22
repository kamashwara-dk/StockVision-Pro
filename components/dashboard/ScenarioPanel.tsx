"use client"

import { useEffect, useState } from "react"
import { getGlobalScenarios } from "@/lib/api"
import { GlobalScenario } from "@/lib/types"
import { TrendingUp, AlertTriangle, Globe, Cpu, ArrowRight } from "lucide-react"

export function ScenarioPanel() {
  const [scenarios, setScenarios] = useState<GlobalScenario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGlobalScenarios().then((data) => {
      setScenarios(data)
      setLoading(false)
    })
  }, [])

  const getIcon = (name: string) => {
    switch (name) {
      case 'trending-up': return <TrendingUp className="text-[var(--accent)]" size={20} />
      case 'alert-triangle': return <AlertTriangle className="text-[var(--warning)]" size={20} />
      case 'globe': return <Globe className="text-[var(--negative)]" size={20} />
      case 'cpu': return <Cpu className="text-[var(--positive)]" size={20} />
      default: return <Globe size={20} />
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">How world events may impact your portfolio</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 h-48 animate-pulse" />
          ))
        ) : scenarios.map((scenario) => {
          const isPositive = scenario.portfolioImpact > 0
          return (
            <div key={scenario.name} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 flex flex-col hover:bg-[var(--surface)] transition-colors group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-[#0A0F1E] border border-[var(--border)] flex items-center justify-center mb-4">
                {getIcon(scenario.icon)}
              </div>
              
              <h4 className="font-bold text-white mb-2">{scenario.name}</h4>
              <p className="text-sm text-[var(--text-secondary)] mb-4 flex-1 line-clamp-2">{scenario.description}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Est. Impact</span>
                  <span className={`font-mono font-bold ${isPositive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                    {isPositive ? '+' : ''}{scenario.portfolioImpact}%
                  </span>
                </div>
                <div className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-xs font-medium uppercase tracking-wider">
                  Analyze <ArrowRight size={14} className="ml-1" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
