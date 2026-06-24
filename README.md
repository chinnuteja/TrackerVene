# Routine Topology Engine

An ambient-sensing system that learns the daily routine of a single resident, scores how unusual each moment is in real time, detects when the underlying pattern has structurally shifted, and places an AI check-in call to the resident before ever escalating to a caregiver.

It is built around a simple idea: most decline in elderly residents shows up slowly — a drift in routine days before anything looks like an emergency. The system watches the *shape* of a normal day and reacts to meaningful change, not to single odd events.

---

## How it works

A stream of ambient room/activity events flows through four stages:

```
ambient events
      │
      ▼
1. Scorer — semi-Markov routine model + log-normal dwell times
      │      every event → a "surprisal" score (negative log-likelihood)
      │      surprisal feeds a decaying accumulator (DECAY = 0.95)
      ▼
2. Changepoint — Bayesian Online Changepoint Detection (Adams & MacKay, 2007)
      │      tracks whether the resident's whole pattern has shifted
      │      → stable / possible_drift / regime_shift
      ▼
3. Agent — threshold ladder: observe → nudge → check-in → escalate
      │      a regime shift lowers the call threshold (more sensitive
      │      precisely when the baseline is known to have moved)
      ▼
4. Conversation — composes a personalized check-in call, interprets the
         reply (reassuring / worrying / no_answer), then stands down
         or escalates with the full evidence trail
```

### The scoring model

- **Semi-Markov routine model.** Room-to-room transitions are learned per time-of-day bucket (8 buckets). On top of transitions, a **log-normal dwell distribution** models *how long* the resident normally stays in each room — so an unusually long or short stay is itself a signal, not just where they went.
- **Surprisal.** Each event is scored as `−log(p)` under the model — high when the model finds the event unlikely, near zero when it is expected. Surprisal from transition and dwell are blended.
- **Decaying accumulator.** `anomaly_new = 0.95 · anomaly_old + surprisal`. A single odd event fades on its own; a sustained pile-up climbs. This is what stops one strange night from triggering a response.
- **Changepoint detection.** BOCD maintains a probability distribution over the run length of the current regime and updates it online via Bayes' rule. When mass collapses from "long run" to "short run," the resident's behaviour has structurally changed — and the agent's call threshold drops accordingly.

### The conversation layer

When the ladder reaches a check-in, an LLM composes one short, spoken call line grounded in the resident's memory profile (baseline routine, personal details, prior incidents) and the current trigger. The reply is classified into one of three verdicts, each pushing the accumulator up or down. If the LLM is unavailable or errors, the system falls back to deterministic scripted lines and keyword rules — it never hard-fails.

---

## Validation

```
python backend/eval/validate.py
```

```
==========================================================================
  Routine Topology Engine -- Offline Validation
==========================================================================
  Scenario                   Events   Det  Lat(min)  Lat(evts)   FA/day
--------------------------------------------------------------------------
  baseline (clean)              270   n/a       n/a        n/a      0.00
  uti -- 1 day                  282   YES     219.5         12      n/a
  uti -- 3 day                  828   YES     219.5          6      n/a
==========================================================================

HEADLINE: 0 false-alarms/day on baseline | detection in 219.5 min median latency
```

**0 false-alarms/day** on a clean baseline. The nocturnal-deviation signature is detected in a median of **219.5 minutes** from the first off-pattern event — during the night, not at morning rounds.

| Scenario | Profile | Status |
|----------|---------|--------|
| `uti` | Nocturnal bathroom trips (1am–5am) | Detected |
| `uti_multiday` | 3-day ramping arc — reaches regime shift by day 3 | Detected |
| `wandering` | 3am front-door egress | Detected (motion-only) |
| `depressive` | Suppressed morning routine | Absence-sensing limit |

---

## Running locally

**Backend**

```bash
cd backend
pip install -r requirements.txt
python brain/routine_model.py     # build model.npz
python ingestion/inject.py        # build scenario data files
uvicorn app:app --port 8000 --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

Copy `.env.example` to `.env` and fill in the LLM credentials for live calls. Without them, the system runs fully on its deterministic fallback.

---

## Tests

```bash
cd backend
pytest tests/ -v        # 20 passed
```

---

## Tech stack

- **Backend:** Python, FastAPI, NumPy/SciPy, a single WebSocket streaming endpoint.
- **Frontend:** Next.js, React, Tailwind, framer-motion — a live dashboard (animated floorplan, anomaly gauge, routine-stability panel, the call console, and a surprisal timeline).
- **Model:** semi-Markov surprisal scorer, log-normal dwell, online Bayesian changepoint detection.

---

## Project structure

```
backend/
  app.py                  WebSocket server + replay loop
  config.py               thresholds, decay, call pacing
  brain/
    surprisal.py          semi-Markov scorer + dwell NLL
    changepoint.py        Bayesian Online Changepoint Detection
    agent.py              threshold ladder + probe resolution
    conversation.py       call composition + reply interpretation
    memory.py             resident profile + incident store
  ingestion/              data parsing + scenario injection
  eval/validate.py        offline validation harness
  tests/                  unit tests
frontend/
  app/                    dashboard page
  components/             floorplan, gauge, call console, timeline, ...
  hooks/useRoutineFeed.ts WebSocket client + state
```

---

## Environment variables

See `.env.example`. The backend reads LLM credentials and an allowed CORS origin; the frontend reads the backend WebSocket URL (`NEXT_PUBLIC_WS_URL`). All are optional for a local fallback run.
