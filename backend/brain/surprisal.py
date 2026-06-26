import json, numpy as np
from datetime import datetime
from scipy.stats import lognorm
from config import ABSENCE_PERCENTILE, ABSENCE_FLOOR_SECONDS, ABSENCE_CEIL_SECONDS

N_BUCKETS = 8
DECAY = 0.95          # anomaly score memory; higher = longer memory
DWELL_WEIGHT = 0.4    # how much dwell-time anomaly contributes vs transition
DWELL_CAP = 6.0       # cap dwell surprisal to avoid degenerate spikes

def bucket_of(ts_iso):
    return datetime.fromisoformat(ts_iso).hour * N_BUCKETS // 24

class Scorer:
    def __init__(self, model_path="model.npz"):
        d = np.load(model_path, allow_pickle=True)
        self.rooms = list(d["rooms"])
        self.idx = {r: i for i, r in enumerate(self.rooms)}
        self.P = d["P"]

        # Reconstruct dwell distributions from saved stats
        raw_dwell = json.loads(str(d["dwell"]))
        self.dwell_dists = {}
        self.dwell_means = {}
        for k, v in raw_dwell.items():
            parts = k.split("|")
            key = (parts[0], parts[1])
            shape, scale, mean = v
            try:
                self.dwell_dists[key] = lognorm(shape, loc=0, scale=scale)
            except Exception:
                pass
            self.dwell_means[key] = mean

        self.prev_room = None
        self.prev_epoch = None
        self.anomaly = 0.0

    def score(self, e):
        r = e["room"]
        if r not in self.idx:
            return {"surprisal": 0.0, "anomaly": self.anomaly,
                    "reason": "unknown_room", "bucket": 0}
        b = bucket_of(e["ts"])
        s = 0.0
        reason = "routine"

        # === Transition surprisal ===
        if self.prev_room is not None and self.prev_room != r:
            i, j = self.idx[self.prev_room], self.idx[r]
            p = self.P[b, i, j]
            s += -np.log(max(p, 1e-10))
            if p < 0.02:
                reason = f"rare_transition:{self.prev_room}->{r}@bucket{b}"

        # === Semi-Markov dwell surprisal (log-normal) ===
        if self.prev_room is not None and self.prev_epoch is not None:
            dwell = e["epoch"] - self.prev_epoch
            key = (str(b), self.prev_room)
            dist = self.dwell_dists.get(key)
            if dist is not None and dwell > 0:
                # negative log-likelihood under fitted log-normal
                pdf_val = dist.pdf(dwell)
                if pdf_val > 1e-20:
                    dwell_s = min(-np.log(pdf_val), DWELL_CAP)
                else:
                    dwell_s = DWELL_CAP
                # normalize: subtract the expected NLL so routine dwells ~ 0
                expected_nll = -np.log(max(dist.pdf(self.dwell_means.get(key, dwell)), 1e-20))
                dwell_surprise = max(0, dwell_s - expected_nll)
                if dwell_surprise > 1.5:
                    s += DWELL_WEIGHT * dwell_surprise
                    if reason == "routine":
                        reason = f"dwell_anomaly:{self.prev_room}:{dwell:.0f}s@bucket{b}"
            else:
                # fallback: simple z-score if no distribution fitted
                mean = self.dwell_means.get(key, 300.0)
                if dwell > 0 and abs(dwell - mean) / max(mean, 1) > 2.5:
                    s += DWELL_WEIGHT * 2.0
                    if reason == "routine":
                        reason = f"dwell_anomaly:{self.prev_room}:{dwell:.0f}s"

        # === Accumulate with exponential decay ===
        self.anomaly = DECAY * self.anomaly + s
        self.prev_room, self.prev_epoch = r, e["epoch"]

        return {"surprisal": round(float(s), 3),
                "anomaly": round(float(self.anomaly), 3),
                "reason": reason, "bucket": b}

    def expected_silence(self, room: str, bucket: int) -> float:
        """97th-pct dwell time for this room+bucket — how long silence is normal."""
        key = (str(bucket), room)
        dist = self.dwell_dists.get(key)
        if dist is not None:
            raw = dist.ppf(ABSENCE_PERCENTILE)
        else:
            raw = self.dwell_means.get(key, 300.0) * 2.5
        return float(np.clip(raw, ABSENCE_FLOOR_SECONDS, ABSENCE_CEIL_SECONDS))
