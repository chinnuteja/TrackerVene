import json
from datetime import datetime, timedelta

def load_day(day, path="data/casas_clean.jsonl"):
    out = []
    with open(path) as f:
        for line in f:
            e = json.loads(line)
            if e["ts"].startswith(day):
                out.append(e)
    return sorted(out, key=lambda x: x["epoch"])

def find_baseline_day(path="data/casas_clean.jsonl"):
    """Auto-find a good baseline day with normal event density."""
    from collections import Counter
    counts = Counter()
    with open(path) as f:
        for line in f:
            e = json.loads(line)
            counts[e["ts"][:10]] += 1
    good = [(d, c) for d, c in counts.items() if 200 <= c <= 600]
    if good:
        return sorted(good)[len(good)//2][0]  # middle of the timeline
    return sorted(counts.items(), key=lambda x: -x[1])[0][0]

def inject_nocturnal_bathroom(events, n_extra=6):
    """UTI signature: repeated Bedroom->Bathroom trips between 1am-5am."""
    base = events[0]["ts"][:10]
    night = datetime.fromisoformat(f"{base}T01:10:00")
    # find a bathroom sensor from the actual data
    bath_sensors = [e for e in events if e["room"] == "Bathroom"]
    bath_sensor = bath_sensors[0]["sensor"] if bath_sensors else "BathroomA"
    new = []
    for i in range(n_extra):
        t = night + timedelta(minutes=i * 35)
        for val in ["ON", "OFF"]:
            new.append({"ts":t.isoformat(),"epoch":t.timestamp(),
                        "sensor":bath_sensor,"kind":"motion","value":val,
                        "room":"Bathroom","activity":"Unlabeled","_injected":True})
    return sorted(events + new, key=lambda x: x["epoch"])

def suppress_morning_kitchen(events):
    """Depressive/illness signature: the morning kitchen routine never fires."""
    return [e for e in events
            if not (e["room"] == "Kitchen"
                    and 6 <= datetime.fromisoformat(e["ts"]).hour <= 10)]

def inject_3am_egress(events):
    """Wandering signature: front door opens at 3am and never re-closes."""
    base = events[0]["ts"][:10]
    t = datetime.fromisoformat(f"{base}T03:02:00")
    door_sensors = [e for e in events if e["room"] == "FrontDoor"]
    door_sensor = door_sensors[0]["sensor"] if door_sensors else "DoorA"
    ev = {"ts":t.isoformat(),"epoch":t.timestamp(),"sensor":door_sensor,
          "kind":"door","value":"OPEN","room":"FrontDoor",
          "activity":"Unlabeled","_injected":True}
    return sorted(events + [ev], key=lambda x: x["epoch"])

def inject_hallway_gap(events, gap_minutes: int = 15):
    """
    Hallway-fall: trim to the densest 3-hour activity window (eliminating
    sparse daytime gaps that would cause false absence alarms), then carve a
    gap after the first Bedroom event within that window.
    """
    from collections import Counter

    # Find the 1-hour peak, then take ±1 hour around it for context
    hour_counts = Counter(datetime.fromisoformat(e["ts"]).hour for e in events)
    peak_hour   = max(hour_counts, key=hour_counts.get)
    lo, hi      = max(0, peak_hour - 1), min(23, peak_hour + 2)

    window = [e for e in events
              if lo <= datetime.fromisoformat(e["ts"]).hour <= hi]
    if not window:
        window = events[:]

    # Find first Bedroom event in the dense window; fall back to any room
    departure  = next((e for e in window if e["room"] == "Bedroom"), window[0])
    dep_epoch  = departure["epoch"]
    gap_sec    = gap_minutes * 60

    # Keep departure, remove everything in (dep_epoch, dep_epoch+gap_sec)
    filtered = [e for e in window
                if not (dep_epoch < e["epoch"] < dep_epoch + gap_sec)]
    return sorted(filtered, key=lambda x: x["epoch"])


def build_multiday(profile: str, n_days: int = 3, ramp: bool = True,
                   baseline_path: str = "data/casas_clean.jsonl") -> list:
    """
    Concatenate n_days of baseline data with ramping anomaly injection.
    Day 0 = clean baseline. Days 1+ get the profile anomaly with ramping intensity.
    Timestamps are shifted so each day is consecutive (offset by 86400 s).
    """
    baseline_day = find_baseline_day(baseline_path)
    baseline = load_day(baseline_day, path=baseline_path)
    if not baseline:
        raise ValueError(f"No events found for baseline day {baseline_day}")

    all_events: list = []
    for day_idx in range(n_days):
        offset = day_idx * 86400.0
        shifted = []
        for e in baseline:
            s = dict(e)
            s["epoch"] = e["epoch"] + offset
            try:
                dt = datetime.fromisoformat(e["ts"])
                s["ts"] = (dt + timedelta(days=day_idx)).isoformat()
            except Exception:
                pass
            shifted.append(s)

        if day_idx == 0:
            all_events.extend(shifted)
            continue

        intensity = day_idx if ramp else 1
        if profile == "uti":
            shifted = inject_nocturnal_bathroom(shifted, n_extra=3 * intensity)
        elif profile == "wandering":
            shifted = inject_3am_egress(shifted)
        elif profile == "depressive":
            shifted = suppress_morning_kitchen(shifted)

        all_events.extend(shifted)

    return sorted(all_events, key=lambda x: x["epoch"])

def _write(events: list, path: str):
    with open(path, "w") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")
    print(f"  Written {len(events):>5} events -> {path}")

if __name__ == "__main__":
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)) + "/..")

    baseline_day = find_baseline_day()
    print(f"Baseline day: {baseline_day}")

    day = load_day(baseline_day)

    # Single-day anomaly scenarios
    _write(inject_nocturnal_bathroom(day, n_extra=6), "data/casas_anomaly.jsonl")
    _write(inject_nocturnal_bathroom(day, n_extra=6), "data/casas_uti.jsonl")
    _write(inject_3am_egress(day),                    "data/casas_wandering.jsonl")
    _write(suppress_morning_kitchen(day),              "data/casas_depressive.jsonl")

    # Multi-day scenarios (3 days, ramping intensity)
    _write(build_multiday("uti"),        "data/casas_uti_multiday.jsonl")
    _write(build_multiday("wandering"),  "data/casas_wandering_multiday.jsonl")
    _write(build_multiday("depressive"), "data/casas_depressive_multiday.jsonl")

    # Hallway fall: 15-min gap after midday Bedroom departure
    _write(inject_hallway_gap(day, gap_minutes=15), "data/casas_hallway_fall.jsonl")

    print("All scenario files built.")
