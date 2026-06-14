import { NextRequest, NextResponse } from "next/server";

// Real-time quote via Yahoo Finance v8 JSON (no API key required)
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.toUpperCase())}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 60 }, // cache 1 min
    });
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const closes: number[] = result.indicators.quote[0].close;
    const validCloses = closes.filter((c) => c != null && !isNaN(c));
    const price = validCloses[validCloses.length - 1];
    const prevPrice = validCloses[validCloses.length - 2] ?? price;
    const changePct = ((price - prevPrice) / prevPrice) * 100;

    const meta = result.meta ?? {};
    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      price: Math.round(price * 100) / 100,
      change_pct: Math.round(changePct * 100) / 100,
      currency: meta.currency ?? "USD",
      exchange: meta.exchangeName ?? "",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
