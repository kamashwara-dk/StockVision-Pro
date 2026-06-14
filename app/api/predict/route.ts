import { NextRequest, NextResponse } from "next/server";

// Simple linear regression on historical close prices with technical indicators
// Uses Yahoo Finance v8 JSON endpoint (no API key required)

async function fetchYahooHistory(ticker: string, range = "1y") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    next: { revalidate: 300 }, // cache 5 min
  });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No data returned");
  return result;
}

function computeMA(closes: number[], window: number): number[] {
  return closes.map((_, i) => {
    const slice = closes.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function computeRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  for (let i = period; i < closes.length; i++) {
    let gain = 0, loss = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gain += diff;
      else loss -= diff;
    }
    const avgGain = gain / period;
    const avgLoss = loss / period;
    if (avgLoss === 0) { rsi[i] = 100; continue; }
    const rs = avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

function computeBollingerBands(closes: number[], window = 20) {
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const slice = closes.slice(Math.max(0, i - window + 1), i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
    upper.push(mean + 2 * std);
    lower.push(mean - 2 * std);
  }
  return { upper, lower };
}

// Simple multivariate linear regression (OLS via normal equations)
function trainLinearRegression(X: number[][], y: number[]) {
  const n = X.length;
  const d = X[0].length;

  // Add bias column
  const Xb = X.map((row) => [1, ...row]);
  const db = d + 1;

  // XtX
  const XtX: number[][] = Array.from({ length: db }, () => new Array(db).fill(0));
  for (let i = 0; i < n; i++)
    for (let a = 0; a < db; a++)
      for (let b = 0; b < db; b++)
        XtX[a][b] += Xb[i][a] * Xb[i][b];

  // Xty
  const Xty: number[] = new Array(db).fill(0);
  for (let i = 0; i < n; i++)
    for (let a = 0; a < db; a++)
      Xty[a] += Xb[i][a] * y[i];

  // Gaussian elimination to solve XtX * w = Xty
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < db; col++) {
    let maxRow = col;
    for (let row = col + 1; row < db; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    for (let row = col + 1; row < db; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= db; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  const w: number[] = new Array(db).fill(0);
  for (let i = db - 1; i >= 0; i--) {
    w[i] = aug[i][db] / aug[i][i];
    for (let j = i - 1; j >= 0; j--) aug[j][db] -= aug[j][i] * w[i];
  }
  return (features: number[]) => w[0] + features.reduce((s, v, k) => s + v * w[k + 1], 0);
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { ticker, forecast_days = 30 } = await req.json();
    if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

    const result = await fetchYahooHistory(ticker.toUpperCase(), "1y");
    const nativeCurrency: string = result.meta?.currency ?? "USD";
    const timestamps: number[] = result.timestamp;
    const closes: number[] = result.indicators.quote[0].close.map(Number);
    const volumes: number[] = result.indicators.quote[0].volume.map(Number);
    const opens: number[] = result.indicators.quote[0].open.map(Number);
    const highs: number[] = result.indicators.quote[0].high.map(Number);
    const lows: number[] = result.indicators.quote[0].low.map(Number);

    const ma50 = computeMA(closes, 50);
    const ma200 = computeMA(closes, 200);
    const rsi = computeRSI(closes);
    const { upper: bbUpper, lower: bbLower } = computeBollingerBands(closes);

    // Build feature matrix for next-day prediction
    const features: number[][] = [];
    const targets: number[] = [];
    for (let i = 0; i < closes.length - 1; i++) {
      features.push([closes[i], ma50[i], ma200[i], rsi[i], bbUpper[i], bbLower[i], volumes[i] / 1e6]);
      targets.push(closes[i + 1]);
    }

    const predict = trainLinearRegression(features, targets);

    // Evaluate R² on last 20% of data (test set)
    const splitIdx = Math.floor(features.length * 0.8);
    let ssRes = 0, ssTot = 0;
    const testMean = targets.slice(splitIdx).reduce((a, b) => a + b, 0) / (targets.length - splitIdx);
    for (let i = splitIdx; i < features.length; i++) {
      const pred = predict(features[i]);
      ssRes += (targets[i] - pred) ** 2;
      ssTot += (targets[i] - testMean) ** 2;
    }
    const r2 = Math.max(0, 1 - ssRes / ssTot);
    const rmse = Math.sqrt(ssRes / (features.length - splitIdx));

    // Recursive forecast
    const forecastRecords: {
      date: string;
      predicted_close: number;
      bb_upper: number;
      bb_lower: number;
      rsi: number;
    }[] = [];

    let currentCloses = [...closes];
    let currentMa50 = [...ma50];
    let currentMa200 = [...ma200];
    let currentRsi = [...rsi];
    let currentBbUpper = [...bbUpper];
    let currentBbLower = [...bbLower];
    let lastDate = new Date(timestamps[timestamps.length - 1] * 1000);

    for (let d = 0; d < forecast_days; d++) {
      const n = currentCloses.length;
      const feat = [
        currentCloses[n - 1],
        currentMa50[n - 1],
        currentMa200[n - 1],
        currentRsi[n - 1],
        currentBbUpper[n - 1],
        currentBbLower[n - 1],
        volumes[volumes.length - 1] / 1e6,
      ];
      const nextClose = predict(feat);
      const nextDate = addBusinessDays(lastDate, 1);

      // Update rolling indicators
      currentCloses.push(nextClose);
      currentMa50.push(computeMA(currentCloses, 50)[currentCloses.length - 1]);
      currentMa200.push(computeMA(currentCloses, 200)[currentCloses.length - 1]);
      currentRsi.push(computeRSI(currentCloses)[currentCloses.length - 1]);
      const newBB = computeBollingerBands(currentCloses);
      currentBbUpper.push(newBB.upper[currentCloses.length - 1]);
      currentBbLower.push(newBB.lower[currentCloses.length - 1]);

      forecastRecords.push({
        date: nextDate.toISOString().split("T")[0],
        predicted_close: Math.round(nextClose * 100) / 100,
        bb_upper: Math.round(currentBbUpper[currentCloses.length - 1] * 100) / 100,
        bb_lower: Math.round(currentBbLower[currentCloses.length - 1] * 100) / 100,
        rsi: Math.round(currentRsi[currentCloses.length - 1] * 10) / 10,
      });

      lastDate = nextDate;
    }

    const currentPrice = closes[closes.length - 1];
    const targetPrice = forecastRecords[forecastRecords.length - 1].predicted_close;

    // Determine signal direction
    const trend = targetPrice > currentPrice ? "bullish" : "bearish";
    const confidence = Math.round(r2 * 100);

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      currency: nativeCurrency,
      current_price: Math.round(currentPrice * 100) / 100,
      target_price: targetPrice,
      bull_case: Math.round(targetPrice * 1.15 * 100) / 100,
      bear_case: Math.round(targetPrice * 0.85 * 100) / 100,
      confidence: Math.min(95, Math.max(30, confidence)),
      trend,
      metrics: { r2: Math.round(r2 * 10000) / 10000, rmse: Math.round(rmse * 100) / 100 },
      records: forecastRecords,
      key_factors: [
        rsi[rsi.length - 1] > 70 ? "RSI overbought — watch for pullback" : rsi[rsi.length - 1] < 30 ? "RSI oversold — potential reversal" : "RSI neutral",
        closes[closes.length - 1] > ma50[ma50.length - 1] ? "Price above 50-day MA (bullish)" : "Price below 50-day MA (bearish)",
        closes[closes.length - 1] > ma200[ma200.length - 1] ? "Price above 200-day MA (long-term bullish)" : "Price below 200-day MA (long-term bearish)",
        closes[closes.length - 1] > bbUpper[bbUpper.length - 1] ? "Bollinger Band breakout — momentum high" : closes[closes.length - 1] < bbLower[bbLower.length - 1] ? "Below lower Bollinger Band — oversold" : "Price within Bollinger Bands",
      ],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
