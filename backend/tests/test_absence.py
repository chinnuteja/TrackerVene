"""Tests for the expected-silence / absence engine — Q2 + Q3."""
import sys, pathlib, pytest

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

MODEL = ROOT / "model.npz"
pytestmark = pytest.mark.skipif(not MODEL.exists(), reason="model.npz not built")


def _scorer():
    from brain.surprisal import Scorer
    return Scorer(str(MODEL))


def test_expected_silence_returns_positive():
    s = _scorer()
    for room in s.rooms:
        for bucket in range(8):
            v = s.expected_silence(room, bucket)
            assert v > 0, f"expected_silence({room}, {bucket}) must be positive"


def test_expected_silence_clamped_to_floor():
    from config import ABSENCE_FLOOR_SECONDS
    s = _scorer()
    for room in s.rooms:
        for bucket in range(8):
            assert s.expected_silence(room, bucket) >= ABSENCE_FLOOR_SECONDS


def test_expected_silence_clamped_to_ceil():
    from config import ABSENCE_CEIL_SECONDS
    s = _scorer()
    for room in s.rooms:
        for bucket in range(8):
            assert s.expected_silence(room, bucket) <= ABSENCE_CEIL_SECONDS


def test_absence_fires_on_engineered_gap():
    """
    A gap exceeding ABSENCE_CEIL_SECONDS must exceed any room/bucket budget
    (ceil is the hard upper limit — nothing is ever 'normal' beyond 6h).
    A 24-min gap must exceed the budget for Bedroom at bucket 7 (9pm) —
    the hallway-fall scenario's exact timing.
    """
    from config import ABSENCE_CEIL_SECONDS
    s = _scorer()
    # beyond the ceiling: always fires
    gap_beyond_ceil = ABSENCE_CEIL_SECONDS + 1
    for room in s.rooms:
        for bucket in range(8):
            budget = s.expected_silence(room, bucket)
            assert gap_beyond_ceil > budget

    # hallway-fall timing: Bedroom at 9pm (bucket 7), 24-min gap
    # expected_silence should be short (not sleeping yet) → gap must exceed it
    bucket_9pm = 7  # hour 21 → 21*8//24 = 7
    bedroom_budget_9pm = s.expected_silence("Bedroom", bucket_9pm)
    gap_24min = 24 * 60
    assert gap_24min > bedroom_budget_9pm, (
        f"24-min gap must exceed Bedroom budget at 9pm (bucket 7), "
        f"got budget={bedroom_budget_9pm:.0f}s"
    )


def test_absence_does_not_fire_during_normal_events():
    """A 5-second inter-event gap must NOT trigger absence (well below any budget)."""
    s = _scorer()
    gap_5s = 5
    for room in s.rooms:
        for bucket in range(8):
            budget = s.expected_silence(room, bucket)
            assert gap_5s < budget, (
                f"5s gap should be below budget for {room}@bucket{bucket}, "
                f"got budget={budget:.0f}s"
            )


def test_expected_silence_varies_by_room():
    """At least two rooms must have different expected silences (not all pinned to floor)."""
    s = _scorer()
    values = {room: s.expected_silence(room, 2) for room in s.rooms}
    assert len(set(values.values())) > 1, (
        "All rooms have identical expected_silence — model likely has no fitted dists"
    )
