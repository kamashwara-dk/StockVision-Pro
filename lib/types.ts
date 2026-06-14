export interface StockHolding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  sector: string;
}

export interface AIPrediction {
  symbol: string;
  currency: string;   // native currency from Yahoo (USD, INR, GBP …)
  currentPrice: number;
  targetPrice: number;
  confidence: number; // 0-100
  bullCase: number;
  bearCase: number;
  keyFactors: string[];
}

export interface GlobalScenario {
  name: string;
  icon: string;
  description: string;
  portfolioImpact: number;
}

export interface NewsItem {
  headline: string;
  source: string;
  summary: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  timeAgo: string;
}

export interface PortfolioHistory {
  date: string;
  value: number;
}
