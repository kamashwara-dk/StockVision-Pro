"use client"

import { LineChart, Cpu, Globe, Bell, Newspaper, Building2 } from "lucide-react"

/**
 * Feature cards — every description matches what the code actually does.
 * Cards reworded; count, layout and styling are unchanged.
 *
 * Change notes (Phase 3):
 *   1. "Real-Time Portfolio Tracking" → "Portfolio & Holding Tracker"
 *      Reason: quotes are delayed (up to 15 min), not real-time.
 *   2. "AI Price Predictions" → "Next-Day Price Forecasts"
 *      Reason: no "AI"; model is a scikit-learn ensemble; only 1-day
 *      forecasts are produced, not 30/60/90-day targets.
 *   3. "Global Scenario Analysis" → "Market Overview"
 *      Reason: scenario analysis is a static mock; what's real is the
 *      indices overview on the Markets page.
 *   4. "Risk & Volatility Alerts" → "Portfolio Return Summary"
 *      Reason: no alert system exists; the stats row shows return/risk
 *      computed from holdings data.
 *   5. "News Sentiment Analysis" → "Market Data from Yahoo Finance"
 *      Reason: news sentiment is entirely static mock data.
 *   6. "Multi-Exchange Support" → "NSE, BSE, NYSE & NASDAQ"
 *      Reason: crypto is not supported; LSE is not supported; stays factual.
 */
const features = [
  {
    title: "Portfolio & Holding Tracker",
    description:
      "Add your holdings manually and track their value using delayed quotes from Yahoo Finance. Prices update whenever you refresh.",
    icon: LineChart,
  },
  {
    title: "Next-Day Price Forecasts",
    description:
      "For any NSE, BSE or US-listed equity, the model trains on up to 10 years of daily data and predicts the next closing price. Accuracy is measured on held-out data.",
    icon: Cpu,
  },
  {
    title: "Market Overview",
    description:
      "See delayed quotes for key Indian and global indices — Nifty 50, Sensex, S&P 500, Dow Jones, NASDAQ and more — on the Markets page.",
    icon: Globe,
  },
  {
    title: "Portfolio Return Summary",
    description:
      "The dashboard shows your total portfolio value, all-time return against your average cost, and a simple risk score derived from each holding's return spread.",
    icon: Bell,
  },
  {
    title: "Market Data from Yahoo Finance",
    description:
      "All price data comes from Yahoo Finance. Quotes are end-of-day or delayed up to 15 minutes. Historical data goes back up to 10 years for supported tickers.",
    icon: Newspaper,
  },
  {
    title: "NSE, BSE, NYSE & NASDAQ",
    description:
      "Search and analyse equities and ETFs listed on NSE, BSE, NYSE, NASDAQ, NYSE Arca and NYSE American. Enter any ticker symbol to run a forecast.",
    icon: Building2,
  },
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
          <h2 className="text-3xl md:text-5xl font-bold text-white">What StockVision Pro actually does.</h2>
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
