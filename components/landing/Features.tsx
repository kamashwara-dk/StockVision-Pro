"use client"

import { LineChart, Cpu, Globe, Bell, Newspaper, Building2 } from "lucide-react"

const features = [
  {
    title: "Real-Time Portfolio Tracking",
    description: "Connect your brokerages and track your net worth with millisecond accuracy across all your devices.",
    icon: LineChart
  },
  {
    title: "AI Price Predictions",
    description: "Our proprietary machine learning models forecast 30, 60, and 90-day price targets with high confidence.",
    icon: Cpu
  },
  {
    title: "Global Scenario Analysis",
    description: "Instantly see how macro events like rate cuts or geopolitical shifts would impact your specific holdings.",
    icon: Globe
  },
  {
    title: "Risk & Volatility Alerts",
    description: "Get notified before the market moves with intelligent alerts based on technical and fundamental shifts.",
    icon: Bell
  },
  {
    title: "News Sentiment Analysis",
    description: "We read thousands of articles a second and grade them Bullish, Bearish, or Neutral for your stocks.",
    icon: Newspaper
  },
  {
    title: "Multi-Exchange Support",
    description: "Trade and track assets across NYSE, NASDAQ, NSE, LSE, and crypto markets seamlessly.",
    icon: Building2
  }
]

export function Features() {
  return (
    <section id="features" className="py-24 bg-[#0A0F1E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Features</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white">Everything you need to trade smarter.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <div 
                key={idx}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 hover:scale-[1.02] hover:border-[var(--accent)] transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center mb-6 group-hover:bg-[var(--accent)] transition-colors">
                  <Icon className="text-[var(--accent)] group-hover:text-[#0A0F1E] w-6 h-6 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
