# StockVision Pro — Methodology

This document is the source text for the `/methodology` page.

---

## Data source

Historical price data is fetched from Yahoo Finance via the yfinance library. Up to ten years of daily bars are requested. All prices are adjusted for stock splits and dividends (Yahoo's `auto_adjust=True`).

**Compliance note**: Yahoo Finance's data endpoints are unofficial. Their terms of service restrict commercial use. This service uses the data for statistical demonstration purposes only. Results are not investment advice.

---

## Data cleaning

The following rules are applied to the raw price series before any model training. Each rule is logged with a counter.

1. **Sorted unique dates**: rows are sorted ascending by date. Duplicate dates are deduplicated; the last occurrence is kept.
2. **Non-positive prices**: rows where the adjusted close is zero or negative are removed. These indicate data errors.
3. **No forward-filling**: missing sessions (holidays, suspensions) are simply absent from the series. The model sees gaps as gaps.
4. **Long gaps**: consecutive sessions separated by more than seven calendar days are flagged in logs. They are not removed.
5. **Possible split artefacts**: sessions where the absolute log-return exceeds 40% are flagged. Because adjusted prices are used throughout, these are most likely data errors rather than real splits. Flagged rows are excluded from model training only.
6. **Minimum history**: at least 750 trading days of clean data are required. Below this threshold the request is refused with an explanatory message. Between 750 days and ten years, all available data is used and the actual date range is shown.

---

## Features

All features for predicting day *t* are constructed from data available through day *t−1* only. There is no look-ahead.

| Feature | Description |
|---------|-------------|
| `log_ret_lag_{1,2,3,5,10,20}` | Log-return lags |
| `rolling_vol_{5,10,20}` | Rolling standard deviation of log-returns over the past window |
| `rsi_14` | RSI(14) using Wilder's exponential smoothing of gains and losses |
| `sma_ratio_5_20` | SMA(5) / SMA(20) — short-term momentum |
| `sma_ratio_10_50` | SMA(10) / SMA(50) — medium-term momentum |
| `vol_zscore_20` | Volume z-score: (today's volume − mean of past 20 days) / std of past 20 days |
| `day_of_week` | Integer 0 (Monday) to 4 (Friday) |

**Target**: next-day log-return, i.e. log(close_t / close_{t−1}). The model predicts this; the predicted price is then close_{t−1} × exp(predicted log-return).

---

## Model

The default model is scikit-learn's `HistGradientBoostingRegressor` with a fixed random state for reproducibility.

**Hyperparameter selection**: a small fixed grid is evaluated using `GridSearchCV` with `TimeSeriesSplit` (5 folds) applied to the training window only. The test window is never used for selection.

---

## Validation scheme

1. **Chronological split**: the first 80% of feature rows are used for training; the remaining 20% form the test window. No shuffling.
2. **Walk-forward evaluation**: the test window is evaluated using an expanding window. The model is refit every 20 trading days. Each test-day prediction uses only the model fitted on data strictly before that day.
3. **No test contamination**: scalers and feature statistics are computed inside each training window only, never on test data.

---

## Metrics

All metrics are computed on the test window only, using the walk-forward predictions. Every number displayed on screen comes directly from the database row for that forecast run.

### Directional accuracy

```
DA = 100 × (correct direction count) / (non-zero-change day count)
```

A "correct direction" is when sign(P_t − A_{t−1}) equals sign(A_t − A_{t−1}), where A is the actual close and P is the prediction. Days where the actual close equals the previous close are excluded from the denominator and this exclusion is noted alongside the metric.

### MAPE

```
MAPE = 100 × mean(|A_t − P_t| / A_t)
```

### RMSE

```
RMSE = sqrt(mean((A_t − P_t)²))
```

Reported in the listing currency (INR for NSE/BSE, USD for NYSE/NASDAQ). Indian digit grouping is used for INR values.

---

## Baselines

The naive baseline assumes tomorrow's price equals today's price (P_t = A_{t−1}).

- **Naive MAPE** and **naive RMSE** are computed on the same test days as the model metrics.
- **Naive directional accuracy** predicts the majority direction observed in the *training window* only.

---

## Verdict

If the model's RMSE and MAPE are both lower than the naive baseline on the test window, the percentage improvements are shown. Otherwise, the following sentence is displayed:

> "On this test period the model does not beat the naive baseline (tomorrow = today)."

No claims of statistical significance are made.

---

## Prediction interval

An 80% interval is computed from the 10th and 90th percentiles of the walk-forward residuals (actual minus predicted, in price space). The empirical coverage — the fraction of test days where the actual price fell inside the interval centred on each test-day prediction — is shown alongside the interval for the final forecast point.

---

## Known limitations

- **Next-day prediction is difficult.** Daily equity prices are close to a random walk. Results at or below the naive baseline are common and expected.
- **End-of-day data.** All prices are end-of-day adjusted closes. Intraday moves are not captured.
- **Data quality.** Yahoo Finance data may contain errors, gaps, or delayed adjustments.
- **No regime detection.** The model treats the entire history as a single regime. Major structural breaks (market crises, delistings) are not handled specially.
- **Features only.** No earnings data, no macro data, no news. The model sees only price and volume history.
- **Not investment advice.** Forecasts are statistical estimates based on historical patterns. Past performance does not predict future results.
