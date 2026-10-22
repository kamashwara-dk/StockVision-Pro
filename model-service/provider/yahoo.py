"""
provider/yahoo.py — YahooProvider implementation.

THIS IS THE ONLY FILE IN THE ENTIRE SERVICE THAT MAY IMPORT yfinance
OR MAKE REQUESTS TO YAHOO FINANCE URLS. All other modules use the
MarketDataProvider interface from base.py.

Compliance warning (reproduced in README):
  yfinance and the Yahoo Finance endpoints it wraps are UNOFFICIAL.
  Yahoo's Terms of Service restrict commercial use. Before deploying
  this to a production environment, evaluate your usage rights and
  consider substituting a licensed data provider via the
  MarketDataProvider interface.

To swap providers: subclass MarketDataProvider in a new file, implement
search() and get_history(), and update the provider instantiation in main.py.
The rest of the service is unaffected.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import date, datetime, timezone
from typing import Optional

import yfinance as yf
import pandas as pd

from provider.base import (
    DataFetchError,
    HistoryResult,
    MarketDataProvider,
    OHLCVRow,
    SearchResult,
    TickerInfo,
    TickerNotFoundError,
)

log = logging.getLogger(__name__)

# ─── Exchange code → display name mapping ─────────────────────────────────────
# Covers NSE, BSE, NYSE, NASDAQ variants, and common ETF venues.
# Symbols on unrecognised exchanges are dropped from search results.
_EXCHANGE_MAP: dict[str, str] = {
    "NSI": "NSE",
    "BSE": "BSE",
    "NYQ": "NYSE",
    "NMS": "NASDAQ",
    "NGM": "NASDAQ",
    "NCM": "NASDAQ",
    "PCX": "NYSE Arca",
    "ASE": "NYSE American",
}

_ALLOWED_QUOTE_TYPES = {"EQUITY", "ETF"}


class YahooProvider(MarketDataProvider):
    """
    MarketDataProvider backed by Yahoo Finance via yfinance.

    Search uses Yahoo's v1 search JSON endpoint directly (not yfinance).
    History uses yfinance's download() with auto_adjust=True.
    """

    # ── Search ────────────────────────────────────────────────────────────────

    def search(self, query: str) -> list[SearchResult]:
        """
        Call Yahoo's search endpoint and return filtered, mapped results.

        Called by the API layer which handles caching and ranking.
        """
        import requests  # local import so non-search code paths don't need it

        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            "q": query,
            "quotesCount": 15,
            "newsCount": 0,
            "enableFuzzyQuery": False,
            "enableCb": False,
        }
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (compatible; StockVisionPro/1.0; "
                "+https://stockvision-pro.vercel.app)"
            ),
            "Accept": "application/json",
        }

        try:
            resp = requests.get(url, params=params, headers=headers, timeout=8)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            raise DataFetchError(f"Yahoo search request failed: {exc}") from exc

        quotes = data.get("quotes") or []
        results: list[SearchResult] = []

        for q in quotes:
            quote_type = (q.get("quoteType") or "").upper()
            if quote_type not in _ALLOWED_QUOTE_TYPES:
                continue

            exchange_code = q.get("exchange") or ""
            exchange_name = _EXCHANGE_MAP.get(exchange_code)
            if exchange_name is None:
                log.debug(
                    "search: dropping symbol=%s exchange=%s (not in allowed set)",
                    q.get("symbol"),
                    exchange_code,
                )
                continue

            symbol = q.get("symbol") or ""
            name = (
                q.get("longname")
                or q.get("shortname")
                or symbol
            )

            results.append(
                SearchResult(
                    symbol=symbol,
                    name=name,
                    exchange=exchange_name,
                    quote_type=quote_type.capitalize(),
                )
            )

        return results

    # ── History ───────────────────────────────────────────────────────────────

    def get_history(self, ticker: str, years: int = 10) -> HistoryResult:
        """
        Download up to *years* years of adjusted OHLCV for *ticker*.

        Uses yfinance auto_adjust=True so Close is the split-and-dividend-
        adjusted close throughout.

        The current (incomplete) trading session is excluded: yfinance
        sometimes includes today's partial bar; we drop it by comparing
        the last bar's date to today's UTC date.
        """
        period = f"{years}y"
        log.info("get_history: ticker=%s period=%s", ticker, period)

        try:
            raw = yf.download(
                ticker,
                period=period,
                interval="1d",
                auto_adjust=True,
                progress=False,
                # Suppress yfinance's multi-ticker multi-index behaviour.
                group_by="ticker",
                threads=False,
            )
        except Exception as exc:
            raise DataFetchError(
                f"Failed to download history for {ticker}: {exc}"
            ) from exc

        # yfinance sometimes returns a MultiIndex when called with a single
        # ticker; flatten it if so.
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.droplevel(1)

        if raw is None or raw.empty:
            raise TickerNotFoundError(
                f"No price data returned for '{ticker}'. "
                "The ticker may be delisted or misspelled."
            )

        # Reset index so Date is a column.
        df = raw.reset_index()

        # Normalise column names (yfinance v0.2+ uses title case).
        df.columns = [str(c).strip() for c in df.columns]

        required = {"Date", "Open", "High", "Low", "Close", "Volume"}
        missing = required - set(df.columns)
        if missing:
            raise DataFetchError(
                f"Yahoo returned incomplete data for {ticker}: "
                f"missing columns {missing}"
            )

        # ── Fetch ticker metadata ──────────────────────────────────────────
        info = self._fetch_info(ticker)

        # ── Exclude the current (incomplete) trading day ───────────────────
        today_utc = datetime.now(timezone.utc).date()
        df["_date"] = pd.to_datetime(df["Date"]).dt.date
        df = df[df["_date"] < today_utc].copy()

        if df.empty:
            raise TickerNotFoundError(
                f"No completed trading sessions found for '{ticker}'."
            )

        # ── Build OHLCVRow list (validation handled in pipeline/validate.py) ─
        rows: list[OHLCVRow] = []
        for _, row in df.iterrows():
            try:
                rows.append(
                    OHLCVRow(
                        date=row["_date"],
                        open=float(row["Open"]),
                        high=float(row["High"]),
                        low=float(row["Low"]),
                        close=float(row["Close"]),
                        volume=float(row["Volume"]) if pd.notna(row["Volume"]) else 0.0,
                    )
                )
            except (TypeError, ValueError) as exc:
                log.warning(
                    "get_history: skipping malformed row date=%s ticker=%s: %s",
                    row.get("_date"),
                    ticker,
                    exc,
                )

        if not rows:
            raise TickerNotFoundError(
                f"All rows for '{ticker}' were malformed or empty."
            )

        return HistoryResult(info=info, rows=rows)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _fetch_info(self, ticker: str) -> TickerInfo:
        """
        Fetch ticker metadata via yfinance Ticker.info.

        Falls back to safe defaults if the info dict is sparse (common for
        ETFs and some international tickers).
        """
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
        except Exception as exc:
            log.warning("_fetch_info: could not fetch info for %s: %s", ticker, exc)
            info = {}

        # Map exchange code to display name.
        exchange_code = info.get("exchange") or ""
        exchange_name = _EXCHANGE_MAP.get(exchange_code, exchange_code or "Unknown")

        # Determine quote type.
        raw_type = (info.get("quoteType") or "EQUITY").upper()
        quote_type = raw_type if raw_type in _ALLOWED_QUOTE_TYPES else "EQUITY"

        # Company name.
        name = (
            info.get("longName")
            or info.get("shortName")
            or ticker
        )

        # Currency.
        currency = (info.get("currency") or "USD").upper()

        return TickerInfo(
            symbol=ticker.upper(),
            name=name,
            exchange=exchange_name,
            currency=currency,
            quote_type=quote_type.capitalize(),
        )
