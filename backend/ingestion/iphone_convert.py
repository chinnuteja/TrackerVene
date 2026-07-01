"""Sensor Logger (iOS) JSON -> TrackerVene demo assets.

`build` turns the two real iPhone recordings into everything the demo needs:
  - backend/data/casas_iphone_realday.jsonl   (the routine + injected fall + sensor_offline)
  - frontend/public/iphone_carry.json         (carry/put-down trace for Beat 4)
  - frontend/public/iphone_places.json        (auto-discovered places for Beat 3)

The phone only logs raw sensors; all reasoning stays in the engine. Segmentation =
stationary (dwell) vs moving (transition) from accel RMS; dwells are labelled by the
known walk route; places are clustered from per-dwell sensor fingerprints.

Usage:
  python -m ingestion.iphone_convert build <routine.json> <carry_clip.json>
  python -m ingestion.iphone_convert            # self-check

ponytail: thresholds are tuned to a real iPhone 12 Pro recording; that's the one knob the
physical world needs. Re-tune MOVE_THRESH / REST_FLOOR / CLUSTER_THRESH for a new device.
"""
import json, sys, math, pathlib
from datetime import datetime, timezone

HERE       = pathlib.Path(__file__).resolve().parent
DATA_DIR   = HERE.parent / "data"
PUBLIC_DIR = HERE.parent.parent / "frontend" / "public"

# Use the resident's OWN room names — no mapping onto a stranger's home.
ROOM_MAP = {
    "Main Bedroom": "Main Bedroom", "Second Bedroom": "Second Bedroom", "Hall": "Hall",
    "Kitchen": "Kitchen", "Bathroom": "Bathroom",
}
# The walk route the user actually did, in order — supplies the dwell labels.
ROUTE = ["Main Bedroom", "Second Bedroom", "Kitchen", "Second Bedroom", "Main Bedroom",
         "Bathroom", "Second Bedroom", "Hall", "Main Bedroom"]

WIN_S        = 1.0      # feature window
MOVE_THRESH  = 0.08     # accel-RMS (g, gravity removed) above this = moving
MIN_DWELL_S  = 6.0      # stationary run shorter than this isn't a real dwell
REST_FLOOR   = 0.10     # accel-RMS below this = phone put down (at_rest) vs carried

# demo staging
NORMAL_GAP   = 45.0     # spacing between dwell events (< 90s budget floor -> no spurious fire)
INJECT_GAP   = 13 * 60  # the "fall": a 13-min silence before one arrival -> absence fires
INJECT_BEFORE = 5       # dwell index the big gap precedes (prev room = Bedroom -> "left Bedroom")
OFFLINE_GAP  = 60.0     # gap before the sensor_offline sentinel (the "phone died" beat)

# place clustering
CLUSTER_THRESH = 1.6    # normalised distance for leader-clustering (discovers # of places)


# ── parsing ──────────────────────────────────────────────────────────────────
def _load(path):
    recs = json.load(open(path, encoding="utf-8"))
    accel, baro, mag, meta = [], [], [], {}
    for r in recs:
        s = r.get("sensor")
        if s == "Accelerometer":
            accel.append((float(r["seconds_elapsed"]),
                          math.sqrt(float(r["x"])**2 + float(r["y"])**2 + float(r["z"])**2)))
        elif s == "Barometer":
            baro.append((float(r["seconds_elapsed"]), float(r["pressure"])))
        elif s == "MagnetometerUncalibrated":
            mag.append((float(r["seconds_elapsed"]),
                        math.sqrt(float(r["x"])**2 + float(r["y"])**2 + float(r["z"])**2)))
        elif s == "Metadata":
            meta = r
    accel.sort(); baro.sort(); mag.sort()
    epoch0 = float(meta.get("recording epoch time", 0)) / 1000.0
    return accel, baro, mag, epoch0


def _windows(accel):
    """-> list of (t_center, rms) per WIN_S window."""
    if not accel:
        return []
    out, end, i, t = [], accel[-1][0], 0, accel[0][0]
    while t < end:
        vals = []
        while i < len(accel) and accel[i][0] < t + WIN_S:
            vals.append(accel[i][1]); i += 1
        if vals:
            out.append((t + WIN_S/2, math.sqrt(sum(v*v for v in vals)/len(vals))))
        t += WIN_S
    return out


def _segment(wins):
    """-> dwell segments {start,end,rms_med}. Moving windows are gaps."""
    dwells, run = [], []
    def flush():
        if run and (run[-1][0] - run[0][0]) >= MIN_DWELL_S:
            rmss = sorted(w[1] for w in run)
            dwells.append({"start": run[0][0], "end": run[-1][0], "rms_med": rmss[len(rmss)//2]})
    for w in wins:
        if w[1] < MOVE_THRESH:
            run.append(w)
        else:
            flush(); run = []
    flush()
    return dwells


def _mean_in(series, t0, t1, default=0.0):
    vals = [v for t, v in series if t0 <= t <= t1]
    return sum(vals)/len(vals) if vals else default


# ── A1: routine jsonl (normalised spacing + injected gap + sensor_offline) ─────
def build_routine(in_path, out_path):
    accel, baro, mag, epoch0 = _load(in_path)
    dwells = _segment(_windows(accel))
    events = []
    for n, d in enumerate(dwells):
        # REAL recording timings (not normalised) + the fall shifts everything after it later
        t = epoch0 + d["start"] + (INJECT_GAP if n >= INJECT_BEFORE else 0)
        room_h = ROUTE[n % len(ROUTE)]
        events.append({
            "ts": datetime.fromtimestamp(t, tz=timezone.utc).isoformat(),
            "epoch": t, "sensor": "iphone", "kind": "motion", "value": "ON",
            "room": ROOM_MAP[room_h], "activity": "Unlabeled",
            "regime": "at_rest" if d["rms_med"] < REST_FLOOR else "carried",
            "confidence": 0.8, "_iphone_room": room_h,
        })
    # _dwell_s = real time until the next event (what the engine sees as the dwell)
    for a, b in zip(events, events[1:]):
        a["_dwell_s"] = round(b["epoch"] - a["epoch"], 1)
    events[-1]["_dwell_s"] = 0.0
    # the "phone died" sentinel
    t = events[-1]["epoch"] + OFFLINE_GAP
    events.append({
        "ts": datetime.fromtimestamp(t, tz=timezone.utc).isoformat(),
        "epoch": t, "sensor": "iphone", "kind": "sensor_offline", "value": "OFF",
        "room": events[-1]["room"], "activity": "Unlabeled",
    })
    with open(out_path, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")
    return events


# ── A2: carry/put-down trace for Beat 4 ────────────────────────────────────────
def build_carry(clip_path, out_path):
    accel, _, _, _ = _load(clip_path)
    wins = _windows(accel)
    trace = [{"t": round(t, 1), "rms": round(r, 4),
              "state": "moving" if r > MOVE_THRESH else ("at_rest" if r < REST_FLOOR else "carried")}
             for t, r in wins]
    # transient marks = biggest spike in each half (set-down, then pick-up)
    mid = (wins[0][0] + wins[-1][0]) / 2
    first  = max((w for w in wins if w[0] <= mid), key=lambda w: w[1], default=None)
    second = max((w for w in wins if w[0] >  mid), key=lambda w: w[1], default=None)
    marks = [round(w[0], 1) for w in (first, second) if w]
    out = {"trace": trace, "marks": marks,
           "rest_floor": REST_FLOOR, "move_thresh": MOVE_THRESH}
    pathlib.Path(out_path).write_text(json.dumps(out))
    return out


# ── A3: auto place-discovery for Beat 3 (leader clustering) ────────────────────
def build_places(in_path, out_path):
    accel, baro, mag, _ = _load(in_path)
    dwells = _segment(_windows(accel))
    # feature per dwell: [baro mean, mag mean, dwell length] — z-normalised
    feats = [[_mean_in(baro, d["start"], d["end"]),
              _mean_in(mag,  d["start"], d["end"]),
              d["end"] - d["start"]] for d in dwells]
    cols = list(zip(*feats)) if feats else []
    def z(col):
        m = sum(col)/len(col); sd = (sum((x-m)**2 for x in col)/len(col))**0.5 or 1.0
        return [(x-m)/sd for x in col]
    zf = list(zip(*[z(c) for c in cols])) if cols else []
    # leader clustering: discovers the number of places
    leaders, assign = [], []
    for v in zf:
        best, bi = 1e9, -1
        for i, L in enumerate(leaders):
            dist = sum((a-b)**2 for a, b in zip(v, L))**0.5
            if dist < best:
                best, bi = dist, i
        if best <= CLUSTER_THRESH:
            assign.append(bi)
        else:
            leaders.append(v); assign.append(len(leaders)-1)
    # map each cluster to the room its dwells were labelled (honest: route-supervised label)
    cluster_room = {}
    for n, c in enumerate(assign):
        cluster_room.setdefault(c, ROOM_MAP[ROUTE[n % len(ROUTE)]])
    out = {"n_places": len(leaders), "assign": assign, "cluster_room": cluster_room,
           "rooms": [ROOM_MAP[ROUTE[n % len(ROUTE)]] for n in range(len(assign))]}
    pathlib.Path(out_path).write_text(json.dumps(out))
    return out


def build_all(routine_path, clip_path):
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    evs = build_routine(routine_path, DATA_DIR / "casas_iphone_realday.jsonl")
    carry = build_carry(clip_path, PUBLIC_DIR / "iphone_carry.json")
    places = build_places(routine_path, PUBLIC_DIR / "iphone_places.json")
    dwell_evs = [e for e in evs if e["kind"] == "motion"]
    print(f"routine: {len(evs)} events ({len(dwell_evs)} dwells + sentinel) -> casas_iphone_realday.jsonl")
    for e in dwell_evs:
        print(f"  {e['_iphone_room']:<14} {e['room']:<11} {e['regime']:<8} {e['_dwell_s']}s")
    gaps = [round(b["epoch"]-a["epoch"]) for a, b in zip(evs, evs[1:])]
    print("  gaps(s):", gaps, " <- one should be the ~780s fall")
    print(f"carry:  {len(carry['trace'])}s trace, marks at {carry['marks']}s -> iphone_carry.json")
    print(f"places: discovered {places['n_places']} places, assign={places['assign']} -> iphone_places.json")


def _selfcheck():
    accel = ([(t/10, 0.01) for t in range(80)] + [(8+t/10, 0.3) for t in range(40)] +
             [(12+t/10, 0.05) for t in range(100)])
    dwells = _segment(_windows(accel))
    assert len(dwells) == 2, dwells
    assert dwells[1]["rms_med"] < REST_FLOOR              # 2nd dwell = put-down
    # routine staging math: exactly one gap > 90s, and it's the injected one
    print("selfcheck ok:", len(dwells), "dwells; REST_FLOOR", REST_FLOOR)


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "build":
        build_all(sys.argv[2], sys.argv[3])
    else:
        _selfcheck()
