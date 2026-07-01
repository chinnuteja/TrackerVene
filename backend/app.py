import asyncio, json, pathlib
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from brain.surprisal   import Scorer, bucket_of
from brain.changepoint import BayesianChangepoint
from brain.agent       import Agent
from brain.location    import LocationBelief
from brain.memory      import load_memory, add_incident, memory_brief
from brain.conversation import interpret_reply

import os
from config import (
    PROBE_COMPOSE_DELAY, PROBE_RING_DELAY,
    PROBE_SCRIPT_HOLD_BASE, PROBE_SCRIPT_CHAR_SECS,
    PROBE_LISTEN_DELAY, PROBE_INTERPRET_DELAY,
    PROBE_INTERACTIVE_TIMEOUT,
)

# ── CORS ───────────────────────────────────────────────────────────────────
# Accept a comma-separated list so multiple Vercel preview URLs work too.
_raw = os.getenv("VENE_ALLOWED_ORIGIN", "")
_ALLOWED_ORIGINS = (
    ["*"]  # wildcard if env var is exactly "*"
    if _raw.strip() == "*"
    else [o.strip() for o in _raw.split(",") if o.strip()]
         + ["http://localhost:3000", "http://localhost:3001"]
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Data files per scenario ────────────────────────────────────────────────
DATA_DIR = pathlib.Path(__file__).parent / "data"

SCENARIO_FILES = {
    "calm":                DATA_DIR / "casas_calm.jsonl",
    "uti":                 DATA_DIR / "casas_uti.jsonl",
    "wandering":           DATA_DIR / "casas_wandering.jsonl",
    "depressive":          DATA_DIR / "casas_depressive.jsonl",
    "hallway_fall":        DATA_DIR / "casas_hallway_fall.jsonl",
    "iphone_realday":      DATA_DIR / "casas_iphone_realday.jsonl",
    "uti_multiday":        DATA_DIR / "casas_uti_multiday.jsonl",
    "wandering_multiday":  DATA_DIR / "casas_wandering_multiday.jsonl",
    "depressive_multiday": DATA_DIR / "casas_depressive_multiday.jsonl",
}

# Synthetic replies Vene would hear from Mary in each scenario (auto mode)
SCENARIO_REPLIES = {
    "calm":            "I'm fine dear, just needed some water.",
    "uti":             "I keep needing the bathroom and my side is hurting a bit.",
    "wandering":       "",                                        # no answer
    "depressive":      "I don't know… I just don't feel like doing anything today.",
    "hallway_fall":    "",                                        # no answer → escalate
    "iphone_realday":  "",                                        # no answer → escalate
    "uti_multiday":    "I keep needing the bathroom and my side is hurting a bit.",
    "wandering_multiday":  "",
    "depressive_multiday": "I don't know… I just don't feel like doing anything today.",
}

SPEED           = 600.0
SPEED_MULTIDAY  = 1800.0   # faster replay for 3-day arcs (~4 min total)
SPEED_IPHONE    = 8.0      # slow replay for the 10-event iPhone demo so beats breathe
MAX_GAP         = 8.0

# ── Helpers ────────────────────────────────────────────────────────────────
def _load_day(path: pathlib.Path, day: str | None):
    evs = []
    with open(path) as f:
        for line in f:
            try:
                e = json.loads(line)
                if day is None or e["ts"].startswith(day):
                    evs.append(e)
            except json.JSONDecodeError:
                pass
    return sorted(evs, key=lambda e: e["epoch"])

def _auto_pick_day(path: pathlib.Path) -> str:
    from collections import Counter
    counts: Counter = Counter()
    with open(path) as f:
        for line in f:
            try:
                e = json.loads(line)
                counts[e["ts"][:10]] += 1
            except json.JSONDecodeError:
                pass
    good = [(d, c) for d, c in counts.items() if 200 <= c <= 600]
    if good:
        return sorted(good, key=lambda x: -x[1])[len(good) // 2][0]
    return sorted(counts.items(), key=lambda x: -x[1])[0][0]

def _append_incident(incident: dict):
    path = DATA_DIR / "incidents.jsonl"
    with open(path, "a") as f:
        f.write(json.dumps(incident) + "\n")

# ── WebSocket ──────────────────────────────────────────────────────────────
@app.websocket("/ws/feed")
async def feed(ws: WebSocket):
    await ws.accept()

    # ── query params ──────────────────────────────────────────────────────
    params   = dict(ws.query_params)
    scenario = params.get("scenario", "calm")
    mode     = params.get("mode",     "auto")   # "auto" | "interactive"

    data_file = SCENARIO_FILES.get(scenario, SCENARIO_FILES["calm"])
    if not data_file.exists():
        await ws.send_json({"type": "error",
                            "msg": f"data file not found for scenario '{scenario}'"})
        return

    # ── load memory & brain ──────────────────────────────────────────────
    memory  = load_memory()
    # iphone scenario is the candidate's OWN home — no "Mary", no borrowed profile/history
    if scenario == "iphone_realday":
        memory = {**memory, "name": "the resident", "prior_incidents": [],
                  "personal_details": [], "baseline_summary": "", "age": ""}
    # iphone scenario uses a model of the resident's OWN home, not Mary's CASAS model
    model_file = "model_iphone.npz" if scenario == "iphone_realday" else "model.npz"
    scorer  = Scorer(model_file)
    cpd     = BayesianChangepoint(hazard_rate=1 / 200)
    agent   = Agent(memory=memory)

    # multiday files span all days — load everything; single-day files filter to one day
    if scenario.endswith("_multiday"):
        day    = "all"
        events = _load_day(data_file, day=None)
    else:
        day    = _auto_pick_day(data_file)
        events = _load_day(data_file, day)
    if not events:
        await ws.send_json({"type": "error", "msg": f"no events found in {data_file.name}"})
        return

    # ── send initial memory state ─────────────────────────────────────────
    await ws.send_json({
        "type":      "memory",
        "name":      memory.get("name", "Mary"),
        "brief":     memory_brief(memory),
        "incidents": memory.get("prior_incidents", []),
    })

    await ws.send_json({
        "type":  "meta",
        "day":   day,
        "count": len(events),
        "rooms": scorer.rooms,
        "scenario": scenario,
        "mode":     mode,
    })

    # ── interactive mode: concurrent inbound receiver ─────────────────────
    answer_queue: asyncio.Queue = asyncio.Queue()
    receive_task = None

    async def _receive_loop():
        try:
            while True:
                raw = await ws.receive_text()
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "answer":
                        await answer_queue.put(msg.get("text", ""))
                except json.JSONDecodeError:
                    pass
        except (WebSocketDisconnect, Exception):
            pass

    if mode == "interactive":
        receive_task = asyncio.create_task(_receive_loop())

    # ── main replay loop ───────────────────────────────────────────────────
    speed = (SPEED_MULTIDAY if scenario.endswith("_multiday")
             else SPEED_IPHONE if scenario == "iphone_realday"
             else SPEED)
    location_belief   = LocationBelief(scorer.rooms, scorer.P)

    prev              = events[0]["epoch"]
    probe_active      = False   # guard: one probe at a time
    probe_cooldown    = 0       # events remaining before next probe is allowed
    escalated         = False   # once escalated, no more probes this session
    MAX_PROBES        = 3       # cap for the demo arc
    probes_fired      = 0
    absence_fired     = False   # guard: one absence episode at a time
    prev_ts_iso       = None    # iso timestamp of last processed event

    try:
        for e in events:
            # ── observability: the phone went dark — silence is NOT 'all clear' ──
            if e.get("kind") == "sensor_offline":
                await asyncio.sleep(min((e["epoch"] - prev) / speed, MAX_GAP))
                await ws.send_json({
                    "type":         "blind",
                    "from_room":    scorer.prev_room or e.get("room"),
                    "last_seen_ts": prev_ts_iso,
                    "msg":          "Signal lost — the phone went dark. We can no longer see "
                                    "movement, so this is NOT 'all clear'.",
                })
                incident = {
                    "ts":         datetime.utcnow().isoformat(),
                    "kind":       "observability",
                    "summary":    "sensor_offline — lost visibility",
                    "action":     "escalate_caregiver",
                    "resolution": "blind — asked caregiver to check in person",
                }
                add_incident(memory, incident)
                _append_incident(incident)
                await ws.send_json({"type": "incident", "incident": incident})
                await ws.send_json({"type": "memory",
                                    "brief": memory_brief(memory),
                                    "incidents": memory.get("prior_incidents", [])})
                break

            gap   = e["epoch"] - prev
            delay = min(gap / speed, MAX_GAP)

            # ── absence watchdog: gap exceeded expected-silence budget? ──────
            silence_budget = None
            if scorer.prev_room is not None and prev_ts_iso is not None:
                b_prev         = bucket_of(prev_ts_iso)
                silence_budget = scorer.expected_silence(scorer.prev_room, b_prev)
                # Only fire when crossing rooms: same-room re-fires are liveness, not gaps
                if (not absence_fired and not escalated and gap > silence_budget
                        and e["room"] != scorer.prev_room):
                    absence_fired = True
                    within_room   = (e["room"] == scorer.prev_room)
                    await ws.send_json({
                        "type":            "absence",
                        "from_room":       scorer.prev_room,
                        "last_seen_ts":    prev_ts_iso,
                        "silent_for":      round(gap),
                        "expected_within": round(silence_budget),
                        "within_room":     within_room,
                        "severity":        "high",
                    })
                    # boost anomaly so the next decision fires a check-in
                    scorer.anomaly = max(scorer.anomaly, 10.0)

            prev = e["epoch"]
            await asyncio.sleep(max(delay, 0))

            # ── location belief: diffuse then observe ────────────────────────
            b_now = bucket_of(e["ts"])
            location_belief.predict(b_now)
            location_belief.observe(e["room"])
            loc_state = location_belief.state()

            liveness = (
                "quiet" if silence_budget is not None and gap > silence_budget * 0.5
                else "active"
            )

            # reset absence guard once a new event arrives
            absence_fired = False
            prev_ts_iso   = e["ts"]

            score    = scorer.score(e)
            cp_state = cpd.update(score["surprisal"])
            # cold-start: a few days of data can't justify a "regime shift" claim — stay
            # conservative so only an unambiguous signal (the absence boost) fires a check-in.
            if scenario == "iphone_realday":
                cp_state = {**cp_state, "stability": "stable"}
            decision = agent.decide(score, cp_state, e)

            await ws.send_json({
                "type":        "event",
                "event":       e,
                "score":       score,
                "decision":    decision,
                "changepoint": cp_state,
                "location":    loc_state,
                "liveness":    liveness,
            })

            # ── tick down cooldown counter ────────────────────────────────
            if probe_cooldown > 0:
                probe_cooldown -= 1

            # ── conversational probe ──────────────────────────────────────
            can_probe = (
                decision["action"] == "soft_checkin"
                and not probe_active
                and not escalated
                and probe_cooldown == 0
                and probes_fired < MAX_PROBES
            )
            if can_probe:
                probe_active   = True
                probes_fired  += 1
                script = decision.get("script", decision["explanation"])

                # ── phase 1: composing ────────────────────────────────────
                await ws.send_json({"type": "call", "phase": "composing"})
                await asyncio.sleep(PROBE_COMPOSE_DELAY)

                # ── phase 2: ringing ──────────────────────────────────────
                await ws.send_json({"type": "call", "phase": "ringing"})
                await asyncio.sleep(PROBE_RING_DELAY)

                # ── phase 3: probe (script starts typing on frontend) ─────
                await ws.send_json({
                    "type":   "probe",
                    "script": script,
                    "reason": decision["trigger"],
                    "source": decision.get("script_source", "fallback"),
                })
                # hold long enough for the typewriter to finish + a beat
                script_hold = max(4.5, len(script) * PROBE_SCRIPT_CHAR_SECS + PROBE_SCRIPT_HOLD_BASE)
                await asyncio.sleep(script_hold)

                # ── phase 4: listening ────────────────────────────────────
                await ws.send_json({"type": "call", "phase": "listening"})

                transcript = ""
                if mode == "auto":
                    await asyncio.sleep(PROBE_LISTEN_DELAY)
                    transcript = SCENARIO_REPLIES.get(scenario, "")
                else:
                    try:
                        transcript = await asyncio.wait_for(
                            answer_queue.get(), timeout=PROBE_INTERACTIVE_TIMEOUT
                        )
                    except asyncio.TimeoutError:
                        transcript = ""

                # ── phase 5: interpreting ─────────────────────────────────
                interp   = interpret_reply(transcript, decision["trigger"], memory)
                verdict  = interp["verdict"]
                resolve  = agent.resolve_probe(verdict)
                await ws.send_json({"type": "call", "phase": "interpreting"})
                await asyncio.sleep(PROBE_INTERPRET_DELAY)

                scorer.anomaly = max(0.0, scorer.anomaly + resolve["delta"])

                await ws.send_json({
                    "type":       "resolution",
                    "verdict":    verdict,
                    "rationale":  interp["rationale"],
                    "transcript": transcript,
                    "delta":      resolve["delta"],
                    "stand_down": resolve["stand_down"],
                    "anomaly":    round(scorer.anomaly, 3),
                })

                if resolve["stand_down"]:
                    # Calm resolved — long cooldown, don't nag Mary again soon
                    probe_cooldown = 120
                else:
                    ts_now = datetime.utcnow().isoformat()
                    incident = {
                        "ts":         ts_now,
                        "kind":       scenario,
                        "summary":    decision["trigger"],
                        "action":     decision["action"],
                        "resolution": f"{verdict} — escalated",
                    }
                    add_incident(memory, incident)
                    _append_incident(incident)
                    await ws.send_json({
                        "type":     "incident",
                        "incident": incident,
                    })
                    await ws.send_json({
                        "type":      "memory",
                        "name":      memory.get("name", "Mary"),
                        "brief":     memory_brief(memory),
                        "incidents": memory.get("prior_incidents", []),
                    })
                    # After worrying/no_answer: short cooldown, then final escalation allowed
                    probe_cooldown = 60
                    if probes_fired >= MAX_PROBES:
                        escalated = True

                probe_active = False

            # ── hard escalation (agent decided without needing a new probe) ──
            elif decision["action"] == "escalate_caregiver" and not escalated:
                escalated = True
                ts_now = datetime.utcnow().isoformat()
                incident = {
                    "ts":         ts_now,
                    "kind":       scenario,
                    "summary":    decision["trigger"],
                    "action":     "escalate_caregiver",
                    "resolution": "escalated to caregiver",
                }
                add_incident(memory, incident)
                _append_incident(incident)
                await ws.send_json({"type": "incident", "incident": incident})
                await ws.send_json({
                    "type":      "memory",
                    "brief":     memory_brief(memory),
                    "incidents": memory.get("prior_incidents", []),
                })

        await ws.send_json({"type": "done", "day": day})

    except WebSocketDisconnect:
        pass
    finally:
        if receive_task:
            receive_task.cancel()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/stats")
def stats():
    path = DATA_DIR / "validation_summary.json"
    if path.exists():
        import json as _json
        return _json.loads(path.read_text())
    return {
        "detection_rate": "n/a",
        "false_alarms_per_day": None,
        "median_latency_min": None,
        "headline": "Run backend/eval/validate.py to generate stats",
    }
