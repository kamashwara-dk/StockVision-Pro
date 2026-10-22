import Link from "next/link"
import { Globe, Mail, MessageCircle } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-[#0A0F1E] border-t border-[var(--border)] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-[var(--accent)]" />
              <span className="text-xl font-bold tracking-tight text-white">StockVision Pro</span>
            </div>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Invest Smarter. Predict Bolder.<br />
              The AI-powered platform for serious investors.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="#features" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="#demo" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Live Demo</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">API Documentation</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} StockVision Pro. All rights reserved.
          </p>
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
