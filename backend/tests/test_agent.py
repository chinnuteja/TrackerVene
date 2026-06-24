"""Tests for Agent decision logic and probe resolution."""
import sys, pathlib, pytest

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from brain.agent import Agent, T_WATCH, T_PROBE, T_CALL


def _score(anomaly: float, reason: str = "test") -> dict:
    return {"anomaly": anomaly, "surprisal": 1.0, "reason": reason, "bucket": 3}


def _cp(stability: str = "stable", change_prob: float = 0.05) -> dict:
    return {"stability": stability, "change_prob": change_prob,
            "run_length": 50, "confidence": 0.9}


def _event(ts: str = "2024-07-09T08:00:00") -> dict:
    return {"ts": ts, "room": "Kitchen", "epoch": 1720512000.0}


def test_observe_below_watch():
    a = Agent()
    d = a.decide(_score(T_WATCH - 0.1), _cp(), _event())
    assert d["action"] == "observe"


def test_soft_checkin_above_probe():
    a = Agent()
    d = a.decide(_score(T_PROBE + 0.5), _cp(), _event())
    assert d["action"] == "soft_checkin"
    assert d["is_probe"] is True


def test_escalate_after_unanswered_probe():
    a = Agent()
    # First decide → soft_checkin (sets probe_pending)
    a.decide(_score(T_PROBE + 1), _cp(), _event())
    # Second decide with sustained anomaly → escalate
    d = a.decide(_score(T_CALL + 1), _cp(), _event())
    assert d["action"] == "escalate_caregiver"
    assert d["is_escalation"] is True


def test_resolve_reassuring_lowers_anomaly():
    a = Agent()
    result = a.resolve_probe("reassuring")
    assert result["delta"] < 0
    assert result["stand_down"] is True
    assert a.probe_pending is False


def test_resolve_worrying_raises_anomaly():
    a = Agent()
    result = a.resolve_probe("worrying")
    assert result["delta"] > 0
    assert result["stand_down"] is False


def test_resolve_no_answer():
    a = Agent()
    result = a.resolve_probe("no_answer")
    assert result["delta"] > 0
    assert result["stand_down"] is False


def test_drift_factor_lowers_thresholds():
    a = Agent()
    # At regime_shift, soft_checkin should fire at a lower anomaly value
    low_anomaly = T_PROBE * 0.7  # below normal T_PROBE but above drift-reduced threshold
    d = a.decide(_score(low_anomaly), _cp(stability="regime_shift"), _event())
    assert d["action"] in ("soft_checkin", "ambient_nudge"), (
        f"Expected check-in under regime_shift at anomaly {low_anomaly}, got {d['action']}"
    )
