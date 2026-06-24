import asyncio, json
from fastapi import FastAPI, WebSocket

DAY = None                  # auto-detect: picks first day with 50+ events
SPEED = 600.0               # 600x: one day -> ~2.4 min. Set 1.0 for true realtime.
MAX_GAP_SECONDS = 8.0       # cap dead air so the demo never stalls on a long sleep gap

def load_day(day, path="data/casas_clean.jsonl"):
    evs = []
    with open(path) as f:
        for line in f:
            e = json.loads(line)
            if day is None or e["ts"].startswith(day):
                evs.append(e)
    return sorted(evs, key=lambda e: e["epoch"])

def auto_pick_day(path="data/casas_clean.jsonl"):
    """Pick a day with healthy event count for demo purposes."""
    from collections import Counter
    counts = Counter()
    with open(path) as f:
        for line in f:
            e = json.loads(line)
            counts[e["ts"][:10]] += 1
    # pick a day with 200-600 events (a normal active day)
    good = [(d, c) for d, c in counts.items() if 200 <= c <= 600]
    if good:
        return sorted(good, key=lambda x: -x[1])[len(good)//2][0]  # median density
    if counts:
        return sorted(counts.items(), key=lambda x: -x[1])[0][0]  # fallback: busiest
    return None

app = FastAPI()

@app.websocket("/ws/feed")
async def feed(ws: WebSocket):
    await ws.accept()
    day = DAY or auto_pick_day()
    if not day:
        await ws.send_json({"type": "error", "msg": "No valid day found in dataset"})
        return
    events = load_day(day)
    if not events:
        await ws.send_json({"type": "error", "msg": f"no events for {day}"})
        return
    await ws.send_json({"type": "meta", "day": day, "count": len(events),
                        "rooms": sorted({e["room"] for e in events})})
    prev = events[0]["epoch"]
    for e in events:
        delay = min((e["epoch"] - prev) / SPEED, MAX_GAP_SECONDS)
        prev = e["epoch"]
        await asyncio.sleep(max(delay, 0))
        await ws.send_json({"type": "event", **e})
    await ws.send_json({"type": "done", "day": day})
