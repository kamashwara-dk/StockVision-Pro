import Link from "next/link"
import { Globe, Mail, MessageCircle } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-[#0A0F1E] border-t border-[var(--border)] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">

          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-[var(--accent)]" />
              <span className="text-xl font-bold tracking-tight text-white">StockVision Pro</span>
            </div>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Portfolio tracking and price forecasts<br />
              from historical market data.
            </p>
          </div>

          {/* Product — only links that go somewhere real */}
          <div>
            <h4 className="text-white font-bold mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="#features" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#demo" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                  Dashboard preview
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                  Go to dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Data */}
          <div>
            <h4 className="text-white font-bold mb-4">Data</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://finance.yahoo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  Yahoo Finance (source)
                </a>
              </li>
              <li>
                <span className="text-sm text-[var(--text-secondary)]">
                  Quotes delayed up to 15 min
                </span>
              </li>
              <li>
                <span className="text-sm text-[var(--text-secondary)]">
                  NSE · BSE · NYSE · NASDAQ
                </span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-bold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <span className="text-sm text-[var(--text-secondary)]">
                  Forecasts are statistical estimates, not investment advice
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} StockVision Pro. All rights reserved.
          </p>
          {/* Social icons preserved — layout unchanged */}
          <div className="flex gap-4">
            <Link href="#" className="text-[var(--text-muted)] hover:text-white transition-colors">
              <MessageCircle size={20} />
            </Link>
            <Link href="#" className="text-[var(--text-muted)] hover:text-white transition-colors">
              <Mail size={20} />
            </Link>
            <Link href="#" className="text-[var(--text-muted)] hover:text-white transition-colors">
              <Globe size={20} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
