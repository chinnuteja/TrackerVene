"""Tests for data ingestion — JSONL files must be built first."""
import sys, pathlib, json, pytest

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

DATA = ROOT / "data"
REQUIRED_FIELDS = {"ts", "epoch", "room", "sensor", "kind", "value", "activity"}


def _load(path: pathlib.Path) -> list:
    evs = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                evs.append(json.loads(line))
    return sorted(evs, key=lambda e: e["epoch"])


@pytest.mark.parametrize("fname", [
    "casas_clean.jsonl",
    "casas_uti.jsonl",
    "casas_wandering.jsonl",
    "casas_depressive.jsonl",
    "casas_uti_multiday.jsonl",
])
def test_file_exists_and_has_events(fname):
    path = DATA / fname
    assert path.exists(), f"{fname} not found — run ingestion/inject.py"
    evs = _load(path)
    assert len(evs) > 50, f"Too few events in {fname}"


def test_required_fields():
    path = DATA / "casas_clean.jsonl"
    if not path.exists():
        pytest.skip("casas_clean.jsonl not built")
    evs = _load(path)
    for e in evs[:20]:
        missing = REQUIRED_FIELDS - e.keys()
        assert not missing, f"Missing fields {missing} in event: {e}"


def test_epochs_monotonically_increasing():
    path = DATA / "casas_clean.jsonl"
    if not path.exists():
        pytest.skip("casas_clean.jsonl not built")
    evs = _load(path)
    for i in range(1, len(evs)):
        assert evs[i]["epoch"] >= evs[i-1]["epoch"], (
            f"Epoch not monotonic at index {i}: {evs[i-1]['epoch']} -> {evs[i]['epoch']}"
        )


def test_uti_file_has_injected_events():
    path = DATA / "casas_uti.jsonl"
    if not path.exists():
        pytest.skip("casas_uti.jsonl not built")
    evs = _load(path)
    injected = [e for e in evs if e.get("_injected")]
    assert len(injected) > 0, "UTI file should contain _injected events"
    # All injected events should be Bathroom in nocturnal hours
    for e in injected:
        h = int(e["ts"][11:13])
        assert e["room"] == "Bathroom", f"Injected event not in Bathroom: {e}"
        assert 0 <= h < 6, f"Injected event not nocturnal (hour={h}): {e}"


def test_multiday_spans_multiple_days():
    path = DATA / "casas_uti_multiday.jsonl"
    if not path.exists():
        pytest.skip("casas_uti_multiday.jsonl not built")
    evs = _load(path)
    span = evs[-1]["epoch"] - evs[0]["epoch"]
    assert span > 2 * 86400, f"Multiday file spans less than 2 days: {span/86400:.1f}d"
