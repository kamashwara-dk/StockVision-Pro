import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { MarketPulse } from "@/components/dashboard/MarketPulse";

export default function PortfolioPage() {
  return (
    <div className="pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Portfolio Performance
        </h1>
        <p className="text-[var(--text-secondary)]">
          Historical performance and market sentiment.
        </p>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
        <div className="xl:col-span-2">
          <PortfolioChart />
        </div>
        <div className="xl:col-span-1">
          <MarketPulse />
        </div>
      </div>
    </div>
  );
}
