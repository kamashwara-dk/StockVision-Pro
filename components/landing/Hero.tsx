"use client"

import { motion } from "framer-motion"
import Link from "next/link"

export function Hero() {
  return (
    <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-grid z-0 opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0F1E]/80 to-[#0A0F1E] z-0" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">AI-Powered Market Intelligence</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight mb-6"
        >
          Invest Smarter.<br />
          Predict <span className="text-[var(--accent)]">Bolder.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-[var(--text-secondary)] mb-10"
        >
          Track your portfolio in real-time, analyze global market trends, and let AI forecast where your stocks are headed — built for serious investors.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Link 
            href="/dashboard" 
            className="w-full sm:w-auto bg-[var(--accent)] text-[#0A0F1E] px-8 py-4 rounded-xl text-lg font-semibold hover:bg-opacity-90 transition-all text-center"
          >
            Start Free Trial
          </Link>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-sm font-medium text-[var(--text-muted)]"
        >
          Trusted by 12,400+ investors · $2.4B tracked · 89% prediction accuracy
        </motion.div>
      </div>
    </div>
  )
}
