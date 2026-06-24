#!/usr/bin/env python3
"""
Offline validation for the Routine Topology Engine.

Runs each scenario through the scorer without the WS loop and reports:
  - False-alarm rate on clean baseline (alarms / day)
  - Detection rate per anomaly scenario
  - Median detection latency (minutes from first injected event to T_PROBE crossing)

Usage:
    cd backend && python eval/validate.py
"""

import json, sys, statistics, pathlib, os

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)          # so Scorer can find model.npz

from brain.surprisal import Scorer
from config import T_PROBE, T_WATCH, GAUGE_MAX

DATA_DIR = ROOT / "data"

# ── helpers ───────────────────────────────────────────────────────────────────

def load_events(path: pathlib.Path, single_day: bool = False) -> list:
    from collections import Counter
    evs = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    evs.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    evs = sorted(evs, key=lambda e: e["epoch"])
    if single_day:
        counts: Counter = Counter(e["ts"][:10] for e in evs)
        good = [(d, c) for d, c in counts.items() if 200 <= c <= 600]
        day = sorted(good)[len(good) // 2][0] if good else sorted(counts.items(), key=lambda x: -x[1])[0][0]
        evs = [e for e in evs if e["ts"].startswith(day)]
    return evs


def score_all(events: list) -> list:
    scorer = Scorer(str(ROOT / "model.npz"))
    scored = []
    for e in events:
        s = scorer.score(e)
        scored.append({**e, "_anomaly": s["anomaly"], "_surprisal": s["surprisal"]})
    return scored


def false_alarm_stats(scored: list) -> tuple:
    """Return (total FA events, FA events per day) above T_PROBE."""
    fa = [e for e in scored if e["_anomaly"] >= T_PROBE]
    span_days = max((scored[-1]["epoch"] - scored[0]["epoch"]) / 86400, 1)
    return len(fa), round(len(fa) / span_days, 2)


def detection_stats(scored: list, profile: str) -> tuple:
    """
    Return (detected: bool, latency_min: float|None, latency_events: int|None).
    Latency = time from first anomalous event to first T_PROBE crossing.
    """
    # Locate the anomaly start: first injected event, or for depressive the
    # suppressed window start (no injected events, just missing normal ones).
    injection_idx = None
    injection_epoch = None

    for i, e in enumerate(scored):
        if e.get("_injected"):
            injection_idx = i
            injection_epoch = e["epoch"]
            break

    # Depressive profile removes kitchen events → no _injected marker.
    # Proxy: first event after the 06:00 hour on any anomaly day.
    if injection_idx is None and profile == "depressive":
        for i, e in enumerate(scored):
            h = int(e["ts"][11:13])
            if h == 6:
                injection_idx = i
                injection_epoch = e["epoch"]
                break

    if injection_idx is None:
        injection_idx = 0
        injection_epoch = scored[0]["epoch"]

    # First T_PROBE crossing from the injection point onward
    for i, e in enumerate(scored):
        if i < injection_idx:
            continue
        if e["_anomaly"] >= T_PROBE:
            lat_s = e["epoch"] - injection_epoch
            return True, round(lat_s / 60, 1), i - injection_idx

    return False, None, None


# ── scenarios to evaluate ─────────────────────────────────────────────────────

SCENARIOS = [
    # (label, file, profile, is_baseline)
    ("baseline (clean)",    DATA_DIR / "casas_clean.jsonl",           "baseline",   True),
    ("uti — 1 day",         DATA_DIR / "casas_uti.jsonl",              "uti",        False),
    ("wandering — 1 day",   DATA_DIR / "casas_wandering.jsonl",        "wandering",  False),
    ("depressive — 1 day",  DATA_DIR / "casas_depressive.jsonl",       "depressive", False),
    ("uti — 3 day",         DATA_DIR / "casas_uti_multiday.jsonl",     "uti",        False),
    ("wandering — 3 day",   DATA_DIR / "casas_wandering_multiday.jsonl","wandering", False),
    ("depressive — 3 day",  DATA_DIR / "casas_depressive_multiday.jsonl","depressive",False),
]


def run() -> dict:
    model_path = ROOT / "model.npz"
    if not model_path.exists():
        print(f"ERROR: model.npz not found at {model_path}")
        print("       Run: cd backend && python brain/routine_model.py")
        sys.exit(1)

    rows = []
    for label, path, profile, is_baseline in SCENARIOS:
        if not path.exists():
            print(f"  SKIP {label} — file not found: {path.name}")
            continue

        # baseline: use a single representative day for a realistic per-day FA rate
        evs    = load_events(path, single_day=is_baseline)
        scored = score_all(evs)

        if is_baseline:
            fa_total, fa_day = false_alarm_stats(scored)
            rows.append({
                "label":      label,
                "events":     len(scored),
                "detected":   "n/a",
                "lat_min":    "n/a",
                "lat_evts":   "n/a",
                "fa_total":   fa_total,
                "fa_per_day": fa_day,
            })
        else:
            detected, lat_min, lat_evts = detection_stats(scored, profile)
            rows.append({
                "label":      label,
                "events":     len(scored),
                "detected":   "YES" if detected else "NO",
                "lat_min":    str(lat_min) if lat_min is not None else "--",
                "lat_evts":   str(lat_evts) if lat_evts is not None else "--",
                "fa_total":   "n/a",
                "fa_per_day": "n/a",
            })

    # ── pretty print ──────────────────────────────────────────────────────────
    W = 74
    print("\n" + "=" * W)
    print("  Routine Topology Engine -- Offline Validation")
    print("=" * W)
    hdr = f"  {'Scenario':<26} {'Events':>6} {'Det':>5} {'Lat(min)':>9} {'Lat(evts)':>10} {'FA/day':>8}"
    print(hdr)
    print("-" * W)
    for r in rows:
        print(f"  {r['label']:<26} {r['events']:>6} {r['detected']:>5} "
              f"{r['lat_min']:>9} {r['lat_evts']:>10} {r['fa_per_day']:>8}")
    print("=" * W)

    # ── headline stat ─────────────────────────────────────────────────────────
    det_rows    = [r for r in rows if r["detected"] == "YES"]
    anom_rows   = [r for r in rows if r["detected"] not in ("n/a",)]
    base_rows   = [r for r in rows if isinstance(r["fa_per_day"], float)]
    lat_vals    = [float(r["lat_min"]) for r in det_rows if r["lat_min"] not in ("--", "n/a")]

    det_rate    = f"{len(det_rows)}/{len(anom_rows)} scenarios detected"
    fa_str      = (f"{base_rows[0]['fa_per_day']:.2f} false-alarms/day on baseline"
                   if base_rows else "")
    lat_str     = (f"median latency {statistics.median(lat_vals):.1f} min"
                   if lat_vals else "")

    headline = " | ".join(filter(None, [det_rate, fa_str, lat_str]))
    print(f"\n  HEADLINE: {headline}\n")

    # ── write summary JSON for dashboard footer ───────────────────────────────
    summary = {
        "detection_rate":       f"{len(det_rows)}/{len(anom_rows)}",
        "false_alarms_per_day": base_rows[0]["fa_per_day"] if base_rows else None,
        "median_latency_min":   round(statistics.median(lat_vals), 1) if lat_vals else None,
        "headline":             headline,
    }
    out = DATA_DIR / "validation_summary.json"
    out.write_text(json.dumps(summary, indent=2))
    print(f"  Summary written -> {out}\n")
    return summary


if __name__ == "__main__":
    run()
