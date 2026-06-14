import Link from "next/link"

// Static server component — no usePathname needed on landing page
export function Navbar() {
  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center justify-between px-6 py-3 w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-lg font-bold tracking-tight text-white">StockVision</span>
        </div>

        <div className="hidden md:flex items-center space-x-6">
          <a href="#demo" className="text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors">Preview</a>
          <a href="#features" className="text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors">How it Works</a>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-white hover:text-[var(--accent)] transition-colors">
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-[var(--accent)] text-[#0A0F1E] px-5 py-2 rounded-full text-sm font-bold hover:bg-[#00c98d] hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,229,160,0.2)]"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </div>
  )
}
