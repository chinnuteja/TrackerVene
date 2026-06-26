"""Tests for LocationBelief — Q1: probabilistic location tracking."""
import sys, pathlib, pytest
import numpy as np

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

MODEL = ROOT / "model.npz"
pytestmark = pytest.mark.skipif(not MODEL.exists(), reason="model.npz not built")


def _make_belief():
    from brain.location import LocationBelief
    d = np.load(MODEL, allow_pickle=True)
    rooms = list(d["rooms"])
    P     = d["P"]
    return LocationBelief(rooms, P), rooms


def test_observe_concentrates_mass():
    lb, rooms = _make_belief()
    lb.observe(rooms[0])
    state = lb.state()
    assert state["best"] == rooms[0]
    assert state["confidence"] == pytest.approx(1.0, abs=1e-6)


def test_predict_diffuses_belief():
    lb, rooms = _make_belief()
    lb.observe(rooms[0])
    assert lb.state()["confidence"] == pytest.approx(1.0, abs=1e-6)
    # After prediction, confidence must drop (belief spreads)
    lb.predict(bucket=0, steps=4)
    assert lb.state()["confidence"] < 1.0, "predict() should diffuse belief"


def test_observe_after_predict_reconcentrates():
    lb, rooms = _make_belief()
    lb.observe(rooms[0])
    lb.predict(bucket=0, steps=3)
    lb.observe(rooms[1])
    state = lb.state()
    assert state["best"] == rooms[1]
    assert state["confidence"] == pytest.approx(1.0, abs=1e-6)


def test_state_belief_sums_to_one():
    lb, rooms = _make_belief()
    lb.observe(rooms[0])
    lb.predict(bucket=2, steps=2)
    # top-3 belief values should all be <= 1
    for v in lb.state()["belief"].values():
        assert 0.0 <= v <= 1.0


def test_belief_vector_always_normalized():
    lb, rooms = _make_belief()
    for _ in range(10):
        lb.predict(bucket=3, steps=1)
    assert abs(lb.b.sum() - 1.0) < 1e-6, "Belief vector must stay normalized"
