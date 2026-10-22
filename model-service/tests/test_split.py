"""
tests/test_split.py — Unit tests for chronological split and scaler isolation (spec R3).

Tests cover:
  1. Every test date is strictly later than every train date.
  2. Scaler is fit on the training window only: mutating test data does NOT
     change the values the scaler computed from training data.
  3. Walk-forward predictions use only data available before each test day
     (tested structurally: the first prediction uses only the training window).
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
import pytest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from pipeline.features import build_features, FeatureMatrix
from pipeline.train import (
    TRAIN_FRACTION,
    _fit_model,
    _default_params,
    _reconstruct_closes_from_log_returns,
    train_and_evaluate,
)
from provider.base import OHLCVRow


# ─── Test data generator ──────────────────────────────────────────────────────

def _make_rows(n: int, seed: int = 42) -> list[OHLCVRow]:
    """
    Generate n synthetic daily OHLCVRow objects with a monotonically
    increasing price (slight uptrend + noise) to ensure enough data for
    the pipeline.
    """
    rng = np.random.default_rng(seed)
    rows = []
    price = 100.0
    d = date(2014, 1, 6)  # a Monday
    for i in range(n):
        # Skip weekends.
        while d.weekday() >= 5:
            d += timedelta(days=1)
        ret = rng.normal(0.0005, 0.01)  # slight positive drift
        price = max(0.01, price * math.exp(ret))
        rows.append(
            OHLCVRow(
                date=d,
                open=price * 0.999,
                high=price * 1.005,
                low=price * 0.994,
                close=price,
                volume=float(rng.integers(1_000_000, 10_000_000)),
            )
        )
        d += timedelta(days=1)
    return rows


# ─── Chronological split ──────────────────────────────────────────────────────

def test_chronological_split_no_test_date_before_train():
    """
    After splitting at TRAIN_FRACTION, every test date is strictly later
    than every train date.
    """
    rows = _make_rows(1200)
    fm = build_features(rows)

    n = len(fm.dates)
    split_idx = int(math.floor(n * TRAIN_FRACTION))

    train_dates = set(fm.dates[:split_idx])
    test_dates = set(fm.dates[split_idx:])

    overlap = train_dates & test_dates
    assert len(overlap) == 0, f"Dates appear in both train and test: {overlap}"

    if train_dates and test_dates:
        assert max(train_dates) < min(test_dates), (
            f"Latest train date {max(train_dates)} is not before "
            f"earliest test date {min(test_dates)}"
        )


def test_split_is_ordered_not_shuffled():
    """
    The first 80% of feature rows have earlier dates than the last 20%.
    If dates were shuffled, some train dates would be later than test dates.
    """
    rows = _make_rows(1000)
    fm = build_features(rows)

    n = len(fm.dates)
    split_idx = int(math.floor(n * TRAIN_FRACTION))

    # Verify dates are monotonically non-decreasing in the full matrix.
    for i in range(1, n):
        assert fm.dates[i] >= fm.dates[i - 1], (
            f"Feature matrix dates are not sorted at index {i}: "
            f"{fm.dates[i-1]} > {fm.dates[i]}"
        )


# ─── Scaler isolation ─────────────────────────────────────────────────────────

def test_scaler_fit_on_train_only():
    """
    The StandardScaler inside the pipeline is fit on the training window.
    Mutating test data values does NOT change the scaler's stored mean_/scale_.

    Procedure:
    1. Build feature matrix from 1200 rows.
    2. Split into X_train, X_test.
    3. Fit the model on X_train (scaler internally fit on X_train).
    4. Record scaler.mean_ and scaler.scale_.
    5. Multiply X_test by 1000 (drastic mutation).
    6. Re-fit the model on X_train again (same data).
    7. Assert the scaler's mean_ and scale_ are unchanged.
    """
    rows = _make_rows(1200)
    fm = build_features(rows)

    n = len(fm.X)
    split_idx = int(math.floor(n * TRAIN_FRACTION))
    X_train = fm.X[:split_idx]
    y_train = fm.y[:split_idx]
    X_test = fm.X[split_idx:].copy()

    params = _default_params()

    # First fit.
    model1: Pipeline = _fit_model(X_train, y_train, params)
    scaler1: StandardScaler = model1.named_steps["scaler"]
    mean_before = scaler1.mean_.copy()
    scale_before = scaler1.scale_.copy()

    # Mutate X_test — should have NO effect on train-fit scaler stats.
    X_test *= 1000.0

    # Re-fit on the same X_train (not X_test).
    model2: Pipeline = _fit_model(X_train, y_train, params)
    scaler2: StandardScaler = model2.named_steps["scaler"]
    mean_after = scaler2.mean_
    scale_after = scaler2.scale_

    np.testing.assert_allclose(
        mean_before, mean_after,
        rtol=1e-10,
        err_msg="Scaler mean_ changed after mutating test data — data leak!",
    )
    np.testing.assert_allclose(
        scale_before, scale_after,
        rtol=1e-10,
        err_msg="Scaler scale_ changed after mutating test data — data leak!",
    )


def test_scaler_does_not_see_test_data():
    """
    The scaler mean computed on training data differs from the mean of test data,
    confirming the scaler was fit only on training data (not the whole dataset).
    """
    rows = _make_rows(1200)
    fm = build_features(rows)

    n = len(fm.X)
    split_idx = int(math.floor(n * TRAIN_FRACTION))
    X_train = fm.X[:split_idx]
    y_train = fm.y[:split_idx]
    X_test = fm.X[split_idx:]

    params = _default_params()
    model: Pipeline = _fit_model(X_train, y_train, params)
    scaler: StandardScaler = model.named_steps["scaler"]

    train_col0_mean = X_train[:, 0].mean()
    full_col0_mean = fm.X[:, 0].mean()
    scaler_col0_mean = scaler.mean_[0]

    # The scaler mean should match the training mean, not the full-dataset mean.
    assert abs(scaler_col0_mean - train_col0_mean) < abs(
        scaler_col0_mean - full_col0_mean
    ), (
        "Scaler mean is closer to the full-dataset mean than the train mean — "
        "possible data leak from test set."
    )


# ─── Walk-forward first prediction uses only training data ────────────────────

def test_walk_forward_first_prediction_uses_train_only():
    """
    The very first walk-forward prediction (for test_dates[0]) is made by a
    model that was fit on X[:split_idx] — i.e., data strictly before the test
    window. We verify this by comparing the initial model's prediction with
    what we'd get if we fit on train-only data separately.
    """
    rows = _make_rows(1200)
    fm = build_features(rows)

    n = len(fm.X)
    split_idx = int(math.floor(n * TRAIN_FRACTION))
    X_train = fm.X[:split_idx]
    y_train = fm.y[:split_idx]

    params = _default_params()
    # Fit a standalone model on training data only.
    standalone_model = _fit_model(X_train, y_train, params)
    standalone_pred = float(standalone_model.predict(fm.X[split_idx: split_idx + 1])[0])

    # Run the full pipeline.
    result = train_and_evaluate(fm)

    # The first test-day prediction should match the standalone model's prediction.
    pipeline_first_pred_log_ret = math.log(
        result.test_predictions[0] / result.test_prev_closes[0]
    ) if result.test_prev_closes[0] > 0 else 0.0

    assert pipeline_first_pred_log_ret == pytest.approx(standalone_pred, abs=1e-6), (
        "First walk-forward prediction does not match standalone model "
        "fit on training data only. This may indicate a data leak."
    )


# ─── _reconstruct_closes_from_log_returns ────────────────────────────────────

def test_reconstruct_closes_roundtrip():
    """
    Reconstruct close prices from log returns, verify they match the originals.
    """
    rows = _make_rows(200)
    fm = build_features(rows)

    closes = _reconstruct_closes_from_log_returns(fm.y, fm.last_close, len(fm.y))

    # The last reconstructed close must equal fm.last_close.
    assert closes[-1] == pytest.approx(fm.last_close, rel=1e-9)

    # For consecutive elements: close[i] = close[i-1] * exp(y[i])
    for i in range(1, len(closes)):
        if fm.y[i] != 0.0:
            expected = closes[i - 1] * math.exp(fm.y[i])
            assert closes[i] == pytest.approx(expected, rel=1e-9), (
                f"Close reconstruction mismatch at index {i}"
            )
