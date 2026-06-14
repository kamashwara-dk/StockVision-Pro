"use client"

import { motion } from "framer-motion"
import Image from "next/image"

export function DashboardPreview() {
  return (
    <section id="demo" className="py-24 bg-[var(--primary-bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">See it in action</span>
          </div>
          <h2 className="mt-2 text-3xl md:text-5xl font-bold text-white">Your entire portfolio. One intelligent view.</h2>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mx-auto rounded-2xl border border-[var(--border)] bg-[#0D1425] shadow-2xl shadow-[var(--accent-dim)] overflow-hidden"
          style={{ aspectRatio: "16/9", maxWidth: "1024px" }}
        >
          {/* Mac window header */}
          <div className="flex items-center px-4 py-3 bg-[#0A0F1E] border-b border-[var(--border)]">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
            </div>
            <div className="mx-auto text-sm font-medium text-[var(--text-secondary)]">stockvision.pro/dashboard</div>
          </div>
          
          {/* Mockup content */}
          <div className="relative w-full h-full bg-[#0A0F1E] overflow-hidden">
            <Image 
              src="/dashboard-preview.png" 
              alt="Dashboard Preview" 
              width={1536} 
              height={730}
              className="w-full h-auto object-cover object-left-top"
              priority
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
