"""
provider package — data abstraction layer.

Only yahoo.py imports yfinance. Every other module uses the
MarketDataProvider interface from base.py.
"""

from provider.base import (
    DataFetchError,
    HistoryResult,
    MarketDataProvider,
    OHLCVRow,
    SearchResult,
    TickerInfo,
    TickerNotFoundError,
)
from provider.yahoo import YahooProvider

__all__ = [
    "DataFetchError",
    "HistoryResult",
    "MarketDataProvider",
    "OHLCVRow",
    "SearchResult",
    "TickerInfo",
    "TickerNotFoundError",
    "YahooProvider",
]
