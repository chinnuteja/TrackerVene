from dataclasses import dataclass, asdict
from dateutil import parser as dtp
import json, pathlib, re

# === Format A: Coded sensor IDs (Aruba, older homes) ===
CODED_ROOM_MAP = {
    "M001":"Bedroom","M002":"Bedroom","M003":"Bedroom",
    "M004":"Bathroom","M005":"Bathroom",
    "M006":"Kitchen","M007":"Kitchen","M008":"Kitchen","M009":"Kitchen",
    "M010":"LivingRoom","M011":"LivingRoom","M012":"LivingRoom",
    "M013":"DiningRoom","M014":"DiningRoom",
    "M015":"Entry","M016":"Office","M017":"Office",
    "M018":"LivingRoom","M019":"LivingRoom","M020":"LivingRoom",
    "M021":"Kitchen","M022":"Kitchen","M023":"Bedroom",
    "M024":"Bedroom","M025":"DiningRoom","M026":"DiningRoom",
    "M027":"Entry","M028":"Entry","M029":"Office","M030":"Office","M031":"Bathroom",
    "D001":"FrontDoor","D002":"FrontDoor","D003":"BackDoor","D004":"BackDoor",
}

# === Format B: Descriptive sensor IDs (HH101+ longitudinal) ===
# Map descriptive prefixes -> canonical room names
DESC_ROOM_PATTERNS = [
    (re.compile(r"^Bedroom",  re.I), "Bedroom"),
    (re.compile(r"^Bathroom", re.I), "Bathroom"),
    (re.compile(r"^Kitchen",  re.I), "Kitchen"),
    (re.compile(r"^Living",   re.I), "LivingRoom"),
    (re.compile(r"^Dining",   re.I), "DiningRoom"),
    (re.compile(r"^Office|^Study", re.I), "Office"),
    (re.compile(r"^Entry|^Hall",   re.I), "Entry"),
    (re.compile(r"^Door|^Front",   re.I), "FrontDoor"),
    (re.compile(r"^Back",          re.I), "BackDoor"),
]

@dataclass
class Event:
    ts: str          # ISO timestamp
    epoch: float     # unix seconds, for replay timing
    sensor: str      # raw id e.g. M003 or BathroomA
    kind: str        # 'motion' | 'door'
    value: str       # ON/OFF/OPEN/CLOSE
    room: str        # mapped routine state
    activity: str    # carried-forward label or 'Unlabeled'

def classify_and_map(sensor: str):
    """Returns (kind, room) or (None, None) if this sensor should be dropped."""
    # Format A: coded IDs
    if sensor.startswith("M"):
        return "motion", CODED_ROOM_MAP.get(sensor, "Other")
    if sensor.startswith("D"):
        return "door", CODED_ROOM_MAP.get(sensor, "FrontDoor")
    if sensor.startswith("T"):
        return None, None  # drop temperature

    # Format B: descriptive IDs
    sensor_up = sensor.strip()
    for pattern, room in DESC_ROOM_PATTERNS:
        if pattern.match(sensor_up):
            kind = "door" if "Door" in room else "motion"
            return kind, room

    return None, None  # unknown sensor -> drop

def is_float(s):
    """Check if a value is a temperature reading (float) -> drop it."""
    try:
        float(s)
        return "." in s  # ON/OFF won't have dots
    except ValueError:
        return False

def parse(path="data/casas_raw.txt"):
    active_label = "Unlabeled"
    out = []
    for line in pathlib.Path(path).read_text(errors="ignore").splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue
        date, time, sensor, value = parts[0], parts[1], parts[2], parts[3]

        # Drop temperature readings (float values like "21.5")
        if is_float(value):
            continue

        kind, room = classify_and_map(sensor)
        if kind is None:
            continue

        # Track activity labels (span-based)
        if len(parts) >= 6 and parts[-1] in ("begin", "end"):
            label = parts[-2]
            if parts[-1] == "begin": active_label = label
            elif parts[-1] == "end": active_label = "Unlabeled"

        try:
            dt = dtp.parse(f"{date} {time}")
            dt = dt.replace(year=dt.year + 11)
        except Exception:
            continue  # skip malformed timestamp lines

        out.append(Event(
            ts=dt.isoformat(), epoch=dt.timestamp(),
            sensor=sensor, kind=kind, value=value.upper(),
            room=room, activity=active_label
        ))
    return out

if __name__ == "__main__":
    events = parse()
    with open("data/casas_clean.jsonl", "w") as f:
        for e in events:
            f.write(json.dumps(asdict(e)) + "\n")
    rooms = {e.room for e in events}
    days = {e.ts[:10] for e in events}
    print(f"Parsed {len(events)} clean events "
          f"across {len(rooms)} rooms, spanning {len(days)} days.")
    print(f"Rooms: {sorted(rooms)}")
    if days:
        print(f"Date range: {min(days)} → {max(days)}")
    else:
        print("Warning: No valid events found.")
