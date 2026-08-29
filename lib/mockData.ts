import { StockHolding, AIPrediction, GlobalScenario, NewsItem, PortfolioHistory } from './types';

export const mockHoldings: StockHolding[] = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', shares: 10,  avgCost: 2800.00, currentPrice: 2950.00, sector: 'Energy',       currency: 'INR' },
  { symbol: 'TCS.NS',      name: 'TCS',                 shares: 5,   avgCost: 3400.00, currentPrice: 3600.00, sector: 'Technology',   currency: 'INR' },
  { symbol: 'INFY.NS',     name: 'Infosys',             shares: 20,  avgCost: 1350.00, currentPrice: 1480.00, sector: 'Technology',   currency: 'INR' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank',           shares: 15,  avgCost: 1550.00, currentPrice: 1620.00, sector: 'Finance',      currency: 'INR' },
  { symbol: 'ICICIBANK.NS',name: 'ICICI Bank',          shares: 25,  avgCost: 900.00,  currentPrice: 970.00,  sector: 'Finance',      currency: 'INR' },
  { symbol: 'WIPRO.NS',    name: 'Wipro',               shares: 30,  avgCost: 440.00,  currentPrice: 460.00,  sector: 'Technology',   currency: 'INR' },
  { symbol: 'TATAMOTORS.NS',name: 'Tata Motors',        shares: 40,  avgCost: 700.00,  currentPrice: 780.00,  sector: 'Automotive',   currency: 'INR' },
  { symbol: 'SUNPHARMA.NS',name: 'Sun Pharma',          shares: 10,  avgCost: 1200.00, currentPrice: 1350.00, sector: 'Healthcare',   currency: 'INR' },
  { symbol: 'CUPID.NS',    name: 'Cupid Ltd',           shares: 5,   avgCost: 282.00,  currentPrice: 282.00,  sector: 'Healthcare',   currency: 'INR' },
  { symbol: 'ONGC.NS',     name: 'ONGC',                shares: 50,  avgCost: 185.00,  currentPrice: 195.00,  sector: 'Energy',       currency: 'INR' },
];

export const mockPredictions: AIPrediction[] = [
  {
    symbol: 'RELIANCE.NS',
    currency: 'INR',
    currentPrice: 2950.00,
    targetPrice: 3200.00,
    confidence: 82,
    bullCase: 3500.00,
    bearCase: 2700.00,
    keyFactors: ['Strong Jio subscriber growth', 'Retail expansion', 'Green energy capex']
  },
  {
    symbol: 'TCS.NS',
    currency: 'INR',
    currentPrice: 3600.00,
    targetPrice: 3900.00,
    confidence: 78,
    bullCase: 4200.00,
    bearCase: 3200.00,
    keyFactors: ['AI-driven deal wins', 'Stable margins', 'Strong dollar revenue']
  },
  {
    symbol: 'INFY.NS',
    currency: 'INR',
    currentPrice: 1480.00,
    targetPrice: 1600.00,
    confidence: 74,
    bullCase: 1750.00,
    bearCase: 1300.00,
    keyFactors: ['Deal pipeline recovery', 'Cost optimisation', 'Cloud migration demand']
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
