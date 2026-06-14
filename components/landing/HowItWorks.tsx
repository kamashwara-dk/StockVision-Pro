export function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Connect your portfolio",
      description: "Securely link your brokerage account via API or enter your holdings manually in seconds."
    },
    {
      num: "02",
      title: "AI analyzes holdings",
      description: "Our engine cross-references your assets with global trends, news sentiment, and historical data."
    },
    {
      num: "03",
      title: "Get predictions & signals",
      description: "Receive actionable buy/sell signals, scenario impact reports, and intelligent price forecasts."
    }
  ]

  return (
    <section id="how-it-works" className="py-24 bg-[var(--surface)] border-y border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Workflow</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Three simple steps to transform how you invest.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-[var(--border)]" />
          
          {steps.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[var(--primary-bg)] border-2 border-[var(--accent)] flex items-center justify-center text-xl font-bold text-[var(--accent)] mb-6 shadow-[0_0_15px_rgba(0,229,160,0.2)]">
                {step.num}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-[var(--text-secondary)]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
