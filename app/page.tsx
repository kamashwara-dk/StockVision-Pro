import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Ticker } from "@/components/landing/Ticker"
import { DashboardPreview } from "@/components/landing/DashboardPreview"
import { Features } from "@/components/landing/Features"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { Footer } from "@/components/landing/Footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--primary-bg)] selection:bg-[var(--accent)] selection:text-[#0A0F1E]">
      <Navbar />
      <main>
        <Hero />
        <Ticker />
        <DashboardPreview />
        <Features />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}
