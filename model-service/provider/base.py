"""
provider/base.py — MarketDataProvider abstract interface.

All data access goes through this interface. Only the concrete provider
implementation (yahoo.py) may import yfinance or call Yahoo URLs. No
other module in this service imports yfinance or references Yahoo directly.
"""

from __future__ import annotations

import abc
import dataclasses
from datetime import date
from typing import Sequence


@dataclasses.dataclass(frozen=True)
class OHLCVRow:
    """One trading-day bar of adjusted OHLCV data."""

    date: date          # exchange-local calendar date
    open: float         # adjusted open
    high: float         # adjusted high
    low: float          # adjusted low
    close: float        # adjusted close  ← model trains on this
    volume: float       # share volume (0 is allowed for some ETFs / thin days)


@dataclasses.dataclass(frozen=True)
class TickerInfo:
    """Metadata returned alongside history."""

    symbol: str         # canonical Yahoo symbol, e.g. "RELIANCE.NS"
    name: str           # human-readable company/fund name
    exchange: str       # mapped exchange name, e.g. "NSE", "NYSE", "NASDAQ"
    currency: str       # ISO 4217 currency code, e.g. "INR", "USD"
    quote_type: str     # "EQUITY" or "ETF"


@dataclasses.dataclass(frozen=True)
class HistoryResult:
    """Return type of MarketDataProvider.get_history()."""

    info: TickerInfo
    rows: Sequence[OHLCVRow]   # sorted ascending by date, no duplicates


@dataclasses.dataclass(frozen=True)
class SearchResult:
    """One suggestion from MarketDataProvider.search()."""

    symbol: str
    name: str
    exchange: str       # mapped exchange name
    quote_type: str     # "EQUITY" or "ETF"


class MarketDataProvider(abc.ABC):
    """
    Abstract data provider.

    Swap the concrete implementation (e.g. YahooProvider) without touching
    any other module. To use a different data source, subclass this class
    and register the new class in main.py.
    """

    @abc.abstractmethod
    def search(self, query: str) -> list[SearchResult]:
        """
        Return up to 15 EQUITY/ETF suggestions for *query*.

        Results are returned in provider-native order; ranking is applied
        by the API layer (search/ranking.py), not here.

        Args:
            query: Raw user query string, 1–50 characters.

        Returns:
            List of SearchResult objects. May be empty.
        """

    @abc.abstractmethod
    def get_history(self, ticker: str, years: int = 10) -> HistoryResult:
        """
        Fetch up to *years* years of daily adjusted OHLCV for *ticker*.

        Contracts:
        - Rows are sorted ascending by date with no duplicates.
        - The current (incomplete) trading day is excluded.
        - Adjusted close is used throughout.
        - Non-positive close prices are excluded before returning.
        - Raises TickerNotFoundError if the ticker is unknown or delisted.
        - Raises DataFetchError on transient network failures.

        Args:
            ticker: Yahoo Finance symbol, e.g. "RELIANCE.NS".
            years:  Maximum history to request; actual range may be shorter.

        Returns:
            HistoryResult with info and rows.
        """


class TickerNotFoundError(Exception):
    """Raised when a ticker is unknown, delisted, or returns no data."""


class DataFetchError(Exception):
    """Raised on transient failures fetching data from the provider."""
