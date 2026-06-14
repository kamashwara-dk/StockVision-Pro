import { StockHolding, AIPrediction, GlobalScenario, NewsItem, PortfolioHistory } from './types';

export const mockHoldings: StockHolding[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', shares: 150, avgCost: 165.20, currentPrice: 195.40, sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', shares: 45, avgCost: 210.50, currentPrice: 185.10, sector: 'Automotive' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', shares: 60, avgCost: 420.00, currentPrice: 850.30, sector: 'Semiconductors' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', shares: 100, avgCost: 310.00, currentPrice: 420.55, sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com', shares: 200, avgCost: 130.40, currentPrice: 178.15, sector: 'Consumer Cyclical' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 80, avgCost: 125.00, currentPrice: 160.20, sector: 'Communication' },
  { symbol: 'META', name: 'Meta Platforms', shares: 120, avgCost: 280.00, currentPrice: 490.10, sector: 'Communication' },
  { symbol: 'NFLX', name: 'Netflix Inc.', shares: 30, avgCost: 410.00, currentPrice: 620.45, sector: 'Communication' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', shares: 250, avgCost: 95.00, currentPrice: 170.80, sector: 'Semiconductors' },
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', shares: 500, avgCost: 2300.00, currentPrice: 2950.00, sector: 'Energy' },
];

export const mockPredictions: AIPrediction[] = [
  {
    symbol: 'AAPL',
    currency: 'USD',
    currentPrice: 195.40,
    targetPrice: 210.00,
    confidence: 85,
    bullCase: 230.00,
    bearCase: 175.00,
    keyFactors: ['Strong Services growth', 'Upcoming iPhone cycle', 'Stable margins']
  },
  {
    symbol: 'TSLA',
    currency: 'USD',
    currentPrice: 185.10,
    targetPrice: 160.00,
    confidence: 72,
    bullCase: 220.00,
    bearCase: 140.00,
    keyFactors: ['Margin pressure', 'Slower EV adoption', 'FSD regulatory hurdles']
  },
  {
    symbol: 'NVDA',
    currency: 'USD',
    currentPrice: 850.30,
    targetPrice: 950.00,
    confidence: 91,
    bullCase: 1100.00,
    bearCase: 750.00,
    keyFactors: ['AI data center demand', 'Next-gen chip release', 'Supply chain stability']
  }
];

export const mockScenarios: GlobalScenario[] = [
  { name: 'Fed Rate Cut', icon: 'trending-up', description: 'If the Federal Reserve cuts interest rates by 50 bps.', portfolioImpact: 4.2 },
  { name: 'Oil Price Spike', icon: 'alert-triangle', description: 'If crude oil prices rise above $100/barrel.', portfolioImpact: -2.1 },
  { name: 'China Tech Slowdown', icon: 'globe', description: 'If Chinese tech manufacturing output decreases.', portfolioImpact: -3.8 },
  { name: 'AI Sector Boom', icon: 'cpu', description: 'If enterprise AI adoption accelerates past projections.', portfolioImpact: 9.4 },
];

export const mockNews: NewsItem[] = [
  { headline: 'Tech stocks rally on strong earnings expectations', source: 'Financial Times', summary: 'Major technology companies are expected to report better-than-expected earnings this quarter.', sentiment: 'Bullish', timeAgo: '2h ago' },
  { headline: 'Inflation data shows persistent core pricing', source: 'Wall Street Journal', summary: 'Core inflation remains sticky, potentially delaying planned interest rate cuts.', sentiment: 'Bearish', timeAgo: '4h ago' },
  { headline: 'EV market faces headwinds amid changing subsidies', source: 'Bloomberg', summary: 'Electric vehicle manufacturers navigate shifting government policies in key markets.', sentiment: 'Neutral', timeAgo: '6h ago' },
];

const generateHistory = (): PortfolioHistory[] => {
  const data: PortfolioHistory[] = [];
  let currentValue = 65000;
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    data.push({
      date: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
      value: currentValue
    });
    const change = 1 + (Math.random() * 0.07 - 0.02);
    currentValue = Math.round(currentValue * change);
  }
  return data;
};

export const mockPortfolioHistory = generateHistory();
