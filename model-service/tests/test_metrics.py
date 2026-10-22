"""
tests/test_metrics.py — Unit tests for pipeline/metrics.py (spec R4).

Tests cover:
  - Directional accuracy with a hand-computed fixture.
  - Zero-change days are excluded from directional accuracy.
  - MAPE hand-computed.
  - RMSE hand-computed.
  - A case where the model loses to the naive baseline.
  - The "beats baseline" verdict is set correctly.
"""

from __future__ import annotations

import math
from datetime import date

import pytest

from pipeline.metrics import MetricsResult, _sign, compute_metrics


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def _make_dates(n: int, start_year: int = 2023) -> list[date]:
    """Generate n consecutive weekday-like dates (not calendar-accurate)."""
    from datetime import timedelta
    d = date(start_year, 1, 2)
    dates = []
    for _ in range(n):
        dates.append(d)
        d += timedelta(days=1)
    return dates


# ─── _sign helper ─────────────────────────────────────────────────────────────

def test_sign_positive():
    assert _sign(3.0) == 1


def test_sign_negative():
    assert _sign(-0.001) == -1


def test_sign_zero():
    assert _sign(0.0) == 0


# ─── Directional accuracy ─────────────────────────────────────────────────────

def test_directional_accuracy_perfect():
    """
    Hand-computed: every prediction moves in the same direction as actual.

    A_prev = [100, 101, 103, 102]
    A      = [101, 103, 102, 104]  (up, up, down, up)
    P      = [102, 104, 101, 105]  (up, up, down, up) — all correct
    Expected DA = 100%
    """
    dates = _make_dates(4)
    a_prev = [100.0, 101.0, 103.0, 102.0]
    a      = [101.0, 103.0, 102.0, 104.0]
    p      = [102.0, 104.0, 101.0, 105.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )

    assert result.directional_accuracy == pytest.approx(100.0)


def test_directional_accuracy_half():
    """
    2 correct out of 4 non-zero-change days → DA = 50%.

    A_prev = [100, 100, 100, 100]
    A      = [101, 101, 99,  99 ]  (up, up, down, down)
    P      = [102, 98,  98,  102]  (up=correct, down=wrong, down=correct, up=wrong)
    Expected DA = 50%
    """
    dates = _make_dates(4)
    a_prev = [100.0, 100.0, 100.0, 100.0]
    a      = [101.0, 101.0,  99.0,  99.0]
    p      = [102.0,  98.0,  98.0, 102.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )

    assert result.directional_accuracy == pytest.approx(50.0)


def test_zero_change_days_excluded():
    """
    Days where A_t == A_{t-1} are excluded from directional accuracy.

    A_prev = [100, 100, 100]
    A      = [100, 101,  99]   ← day 0: zero change (excluded)
    P      = [ 99, 102,  98]   ← day 1: up (correct), day 2: down (correct)
    Only 2 non-zero-change days. Both correct → DA = 100%, n_zero_change = 1.
    """
    dates = _make_dates(3)
    a_prev = [100.0, 100.0, 100.0]
    a      = [100.0, 101.0,  99.0]
    p      = [ 99.0, 102.0,  98.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )

    assert result.n_zero_change_days == 1
    assert result.directional_accuracy == pytest.approx(100.0)


# ─── MAPE ─────────────────────────────────────────────────────────────────────

def test_mape_hand_computed():
    """
    Hand computation:
      A = [100, 200]
      P = [110, 190]
      |errors| / A = [10/100, 10/200] = [0.10, 0.05]
      MAPE = 100 * mean([0.10, 0.05]) = 100 * 0.075 = 7.5
    """
    dates = _make_dates(2)
    a_prev = [90.0, 100.0]
    a      = [100.0, 200.0]
    p      = [110.0, 190.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[88.0, 90.0],
        train_prev_closes=[85.0, 88.0],
    )

    assert result.mape == pytest.approx(7.5, abs=1e-6)


# ─── RMSE ─────────────────────────────────────────────────────────────────────

def test_rmse_hand_computed():
    """
    Hand computation:
      A = [100, 200]
      P = [110, 190]
      errors^2 = [100, 100]
      RMSE = sqrt(100) = 10
    """
    dates = _make_dates(2)
    a_prev = [90.0, 100.0]
    a      = [100.0, 200.0]
    p      = [110.0, 190.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[88.0, 90.0],
        train_prev_closes=[85.0, 88.0],
    )

    assert result.rmse == pytest.approx(10.0, abs=1e-6)


# ─── Model loses to naive baseline ────────────────────────────────────────────

def test_model_loses_to_naive():
    """
    Construct a scenario where the model's RMSE and MAPE are both WORSE
    than naive (P_t = A_{t-1}).

    A_prev = [100, 100]
    A      = [101, 101]   (both days: +1)
    P      = [105, 105]   (model predicts +5, much further from truth than naive +0)

    Naive RMSE  = sqrt(mean([1^2, 1^2])) = 1.0
    Model RMSE  = sqrt(mean([4^2, 4^2])) = 4.0
    Model RMSE > Naive RMSE → beats_baseline = False.
    """
    dates = _make_dates(2)
    a_prev = [100.0, 100.0]
    a      = [101.0, 101.0]
    p      = [105.0, 105.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )

    assert result.rmse == pytest.approx(4.0, abs=1e-6)
    assert result.baseline_rmse == pytest.approx(1.0, abs=1e-6)
    assert result.beats_baseline is False
    assert result.rmse_improvement_pct is None
    assert result.mape_improvement_pct is None


def test_model_beats_naive():
    """
    Model is closer to actual than naive.

    A_prev = [100, 100]
    A      = [102, 104]
    Naive P = A_prev = [100, 100] → errors = [2, 4] → RMSE = sqrt(10) ≈ 3.162
    Model P = [102.5, 103.5]     → errors = [0.5, 0.5] → RMSE = 0.5

    beats_baseline = True.
    """
    dates = _make_dates(2)
    a_prev = [100.0, 100.0]
    a      = [102.0, 104.0]
    p      = [102.5, 103.5]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )

    assert result.beats_baseline is True
    assert result.rmse < result.baseline_rmse
    assert result.mape < result.baseline_mape
    assert result.rmse_improvement_pct is not None
    assert result.mape_improvement_pct is not None


# ─── Baseline directional from training window ────────────────────────────────

def test_baseline_directional_majority_up():
    """
    Training window: 3 up days, 1 down day → majority = up.
    Test window: 2 up days, 1 down day.
    Baseline predicts 'up' every time.
    Baseline correct on 2 of 3 non-zero-change test days → 66.67%.
    """
    dates = _make_dates(3)
    # Test: up, up, down
    a_prev = [100.0, 101.0, 102.0]
    a      = [101.0, 102.0, 101.0]
    p      = [100.0, 100.0, 100.0]  # model prediction doesn't matter for baseline test

    # Train: 3 up, 1 down
    train_actuals      = [101.0, 102.0, 103.0, 102.0]
    train_prev_closes  = [100.0, 101.0, 102.0, 103.0]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=train_actuals,
        train_prev_closes=train_prev_closes,
    )

    # Baseline predicts up every day: correct on days 0 and 1 (both up), wrong on day 2 (down).
    expected_baseline_da = 100.0 * 2 / 3
    assert result.baseline_directional == pytest.approx(expected_baseline_da, abs=0.01)


# ─── n_test_days and date range ───────────────────────────────────────────────

def test_n_test_days_and_dates():
    """MetricsResult.n_test_days equals the number of test rows."""
    dates = _make_dates(5)
    a_prev = [100.0] * 5
    a      = [101.0, 102.0, 100.0, 103.0, 99.0]
    p      = [101.5, 101.5, 100.5, 102.5, 99.5]

    result = compute_metrics(
        test_dates=dates,
        test_actuals=a,
        test_predictions=p,
        test_prev_closes=a_prev,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )

    assert result.n_test_days == 5
    assert result.test_start == dates[0]
    assert result.test_end == dates[-1]
