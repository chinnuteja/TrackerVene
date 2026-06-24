"""Tests for Scorer — requires model.npz to be built first."""
import sys, pathlib, pytest

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

MODEL = ROOT / "model.npz"
pytestmark = pytest.mark.skipif(not MODEL.exists(), reason="model.npz not built")


def _event(room: str, ts: str = "2024-07-09T08:00:00", epoch: float = 1720512000.0) -> dict:
    return {"room": room, "ts": ts, "epoch": epoch,
            "sensor": "X", "kind": "motion", "value": "ON", "activity": "Unlabeled"}


def test_scorer_returns_expected_keys():
    from brain.surprisal import Scorer
    s = Scorer(str(MODEL))
    result = s.score(_event("Kitchen"))
    assert {"surprisal", "anomaly", "reason", "bucket"} <= result.keys()


def test_scorer_anomaly_nonnegative():
    from brain.surprisal import Scorer
    s = Scorer(str(MODEL))
    for room in ["Bedroom", "Kitchen", "Bathroom", "LivingRoom"]:
        r = s.score(_event(room, epoch=s.prev_epoch + 300 if s.prev_epoch else 1720512000.0))
        assert r["anomaly"] >= 0, f"Negative anomaly for {room}"


def test_anomaly_accumulates_on_surprise():
    """Injecting rare transitions must raise anomaly above zero."""
    from brain.surprisal import Scorer
    s = Scorer(str(MODEL))
    base_ts = 1720512000.0
    # Inject 10 rapid rare-room transitions at 3am (bucket 1)
    rooms = s.rooms
    if len(rooms) < 2:
        pytest.skip("Not enough rooms in model")
    ts_3am = "2024-07-09T03:00:00"
    for i in range(10):
        r = s.score({"room": rooms[i % len(rooms)], "ts": ts_3am,
                     "epoch": base_ts + i * 30,
                     "sensor": "X", "kind": "motion", "value": "ON", "activity": "Unlabeled"})
    assert r["anomaly"] > 0.5, "Anomaly should accumulate after repeated surprise"


def test_scorer_handles_unknown_room_gracefully():
    from brain.surprisal import Scorer
    s = Scorer(str(MODEL))
    result = s.score(_event("MarsBase"))
    assert result["reason"] == "unknown_room"
    assert result["surprisal"] == 0.0
