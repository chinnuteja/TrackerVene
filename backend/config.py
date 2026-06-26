# Central config — tune here, never touch the brain logic files.

# ── Replay ────────────────────────────────────────────────────────────────
SPEED   = 600.0   # replay speed multiplier (600x = one 24h day in ~2.4 min)
MAX_GAP = 8.0     # max seconds of real-time gap between events

# ── Anomaly scoring ───────────────────────────────────────────────────────
DECAY        = 0.95   # exponential decay for the anomaly accumulator
DWELL_WEIGHT = 0.4    # contribution of dwell-time surprisal vs transition
DWELL_CAP    = 6.0    # cap on dwell surprisal to avoid degenerate spikes

# ── Agent thresholds ──────────────────────────────────────────────────────
T_WATCH = 4.0     # below this: observe silently
T_PROBE = 8.0     # below this: ambient nudge or soft check-in
T_CALL  = 14.0    # above this + unanswered probe: escalate

DRIFT_THRESHOLD_REDUCTION = 0.6   # multiply thresholds when regime_shift detected

# ── Frontend gauge scale ──────────────────────────────────────────────────
GAUGE_MAX = 14.0  # anomaly value that fills the gauge to 100 %

# ── Conversation ──────────────────────────────────────────────────────────
LLM_TIMEOUT         = 10.0    # seconds before Azure OpenAI call falls back
PROBE_AUTO_DELAY    = 2.5     # kept for backward-compat; no longer the primary timer
PROBE_INTERACTIVE_TIMEOUT = 30.0  # seconds to wait for an interactive answer

# ── Absence / expected-silence model ─────────────────────────────────────────
ABSENCE_PERCENTILE     = 0.97   # how "patient" we are: 97th pct of dwell dist
ABSENCE_FLOOR_SECONDS  = 90     # never fire faster than this
ABSENCE_CEIL_SECONDS   = 6 * 3600  # never wait longer than 6h (overnight sleep)

# ── Call pacing ────────────────────────────────────────────────────────────────
PROBE_COMPOSE_DELAY    = 1.2   # composing → ringing
PROBE_RING_DELAY       = 1.2   # ringing → probe (script starts typing)
PROBE_SCRIPT_HOLD_BASE = 2.0   # extra hold after script finishes (base)
PROBE_SCRIPT_CHAR_SECS = 0.03  # hold per character: max(4.5, len*CHAR + BASE)
PROBE_LISTEN_DELAY     = 2.0   # auto-mode: pause while "listening"
PROBE_INTERPRET_DELAY  = 1.0   # interpreting → resolution
