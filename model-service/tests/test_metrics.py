"""
tests/test_metrics.py — Unit tests for pipeline/metrics.py.

Every expected value is hand-computed from the fixture data below.
Covers:
  - Directional accuracy: perfect, 50%, zero-change exclusion.
  - MAPE hand-computed.
  - RMSE hand-computed.
  - Model loses to naive: beats_baseline = False, improvements = None.
  - Model beats naive: beats_baseline = True, improvements > 0.
  - Majority-direction baseline computed from training window.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from pipeline.metrics import MetricsResult, _sign, compute_metrics


# ─── helpers ──────────────────────────────────────────────────────────────────

def _dates(n: int, start_year: int = 2024) -> list[date]:
    d = date(start_year, 1, 2)
    out = []
    for _ in range(n):
        out.append(d)
        d += timedelta(days=1)
    return out


# ─── _sign ────────────────────────────────────────────────────────────────────

def test_sign_pos():  assert _sign(0.5)  ==  1
def test_sign_neg():  assert _sign(-0.5) == -1
def test_sign_zero(): assert _sign(0.0)  ==  0


# ─── Directional accuracy ─────────────────────────────────────────────────────

def test_da_perfect():
    """All 4 non-zero-change days predicted correctly → DA = 100%."""
    dates = _dates(4)
    # A_prev, A,    P
    # 100→101(up),  P=102(up)   ✓
    # 101→103(up),  P=104(up)   ✓
    # 103→102(down),P=101(down) ✓
    # 102→104(up),  P=105(up)   ✓
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[101, 103, 102, 104],
        test_predictions=[102, 104, 101, 105],
        test_prev_closes=[100, 101, 103, 102],
        train_actuals=[99, 100],
        train_prev_closes=[98, 99],
    )
    assert r.directional_accuracy == pytest.approx(100.0)
    assert r.n_zero_change_days == 0


def test_da_half():
    """2 correct out of 4 non-zero-change days → DA = 50%."""
    dates = _dates(4)
    r = compute_metrics(
        test_dates=dates,
        test_actuals   =[101, 101,  99,  99],
        test_predictions=[102,  98,  98, 102],
        test_prev_closes=[100, 100, 100, 100],
        train_actuals=[99, 100],
        train_prev_closes=[98, 99],
    )
    assert r.directional_accuracy == pytest.approx(50.0)


def test_da_zero_change_excluded():
    """Day 0: A_prev==A → excluded.  Days 1,2 both correct → DA = 100%."""
    dates = _dates(3)
    r = compute_metrics(
        test_dates=dates,
        test_actuals   =[100, 101,  99],
        test_predictions=[ 99, 102,  98],
        test_prev_closes=[100, 100, 100],
        train_actuals=[99, 100],
        train_prev_closes=[98, 99],
    )
    assert r.n_zero_change_days == 1
    assert r.directional_accuracy == pytest.approx(100.0)


# ─── MAPE ─────────────────────────────────────────────────────────────────────

def test_mape_hand_computed():
    """
    A=[100, 200], P=[110, 190]
    terms = [|100-110|/100, |200-190|/200] = [0.10, 0.05]
    MAPE = 100 × mean([0.10, 0.05]) = 7.5
    """
    dates = _dates(2)
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[100.0, 200.0],
        test_predictions=[110.0, 190.0],
        test_prev_closes=[90.0, 100.0],
        train_actuals=[88.0, 90.0],
        train_prev_closes=[85.0, 88.0],
    )
    assert r.mape == pytest.approx(7.5, abs=1e-9)


# ─── RMSE ─────────────────────────────────────────────────────────────────────

def test_rmse_hand_computed():
    """
    A=[100, 200], P=[110, 190]
    errors²=[100, 100], RMSE=sqrt(100)=10.
    """
    dates = _dates(2)
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[100.0, 200.0],
        test_predictions=[110.0, 190.0],
        test_prev_closes=[90.0, 100.0],
        train_actuals=[88.0, 90.0],
        train_prev_closes=[85.0, 88.0],
    )
    assert r.rmse == pytest.approx(10.0, abs=1e-9)


# ─── Model loses to naive ─────────────────────────────────────────────────────

def test_model_loses_to_naive():
    """
    Naive (P=A_prev=100) RMSE = sqrt(mean([1,1])) = 1.
    Model (P=105)        RMSE = sqrt(mean([16,16])) = 4.
    beats_baseline = False; improvements = None.
    """
    dates = _dates(2)
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[101.0, 101.0],
        test_predictions=[105.0, 105.0],
        test_prev_closes=[100.0, 100.0],
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )
    assert r.rmse == pytest.approx(4.0, abs=1e-9)
    assert r.baseline_rmse == pytest.approx(1.0, abs=1e-9)
    assert r.beats_baseline is False
    assert r.rmse_improvement_pct is None
    assert r.mape_improvement_pct is None


# ─── Model beats naive ────────────────────────────────────────────────────────

def test_model_beats_naive():
    """
    A=[102,104], A_prev=[100,100].
    Naive RMSE = sqrt(mean([4,16])) = sqrt(10) ≈ 3.162.
    Model P=[102.5,103.5], RMSE = sqrt(mean([.25,.25])) = 0.5.
    beats = True, improvements > 0.
    """
    dates = _dates(2)
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[102.0, 104.0],
        test_predictions=[102.5, 103.5],
        test_prev_closes=[100.0, 100.0],
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )
    assert r.beats_baseline is True
    assert r.rmse < r.baseline_rmse
    assert r.mape < r.baseline_mape
    assert r.rmse_improvement_pct is not None and r.rmse_improvement_pct > 0
    assert r.mape_improvement_pct is not None and r.mape_improvement_pct > 0


# ─── Majority-direction baseline from training window ─────────────────────────

def test_baseline_directional_majority_up():
    """
    Train: 3 up (99→100, 100→101, 101→102), 1 down (102→101) → majority=up.
    Test: 2 up (100→101, 101→102), 1 down (102→101).
    Baseline predicts "up" every time → correct 2/3 → 66.67%.
    """
    dates = _dates(3)
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[101.0, 102.0, 101.0],
        test_predictions=[100.0, 100.0, 100.0],  # irrelevant for baseline calc
        test_prev_closes=[100.0, 101.0, 102.0],
        train_actuals=[100.0, 101.0, 102.0, 101.0],
        train_prev_closes=[99.0, 100.0, 101.0, 102.0],
    )
    assert r.baseline_directional == pytest.approx(100.0 * 2 / 3, abs=0.02)


# ─── n_test_days and date range ───────────────────────────────────────────────

def test_n_test_days_and_dates():
    dates = _dates(5)
    r = compute_metrics(
        test_dates=dates,
        test_actuals=[101, 102, 100, 103, 99],
        test_predictions=[101.5, 101.5, 100.5, 102.5, 99.5],
        test_prev_closes=[100.0] * 5,
        train_actuals=[99.0, 100.0],
        train_prev_closes=[98.0, 99.0],
    )
    assert r.n_test_days == 5
    assert r.test_start == dates[0]
    assert r.test_end   == dates[-1]
