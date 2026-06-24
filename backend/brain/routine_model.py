import json, numpy as np
from datetime import datetime
from scipy.stats import lognorm

N_BUCKETS = 8
ALPHA = 0.5
MIN_DWELL_SAMPLES = 5  # need at least this many samples to fit a distribution

def bucket_of(ts_iso):
    h = datetime.fromisoformat(ts_iso).hour
    return h * N_BUCKETS // 24

class RoutineModel:
    def __init__(self, rooms):
        self.rooms = sorted(rooms)
        self.idx = {r: i for i, r in enumerate(self.rooms)}
        n = len(self.rooms)
        # transition counts per bucket
        self.counts = np.zeros((N_BUCKETS, n, n))
        # dwell time samples per (bucket, room) — raw samples for fitting
        self._dwell_samples = {(b, r): [] for b in range(N_BUCKETS) for r in self.rooms}
        self.P = None           # transition probabilities (filled by finalize)
        self.dwell_dists = None # log-normal distributions (filled by finalize)

    def fit_day(self, events):
        prev_room, prev_epoch = None, None
        for e in events:
            r = e["room"]
            if r not in self.idx:
                continue
            b = bucket_of(e["ts"])
            if prev_room is not None and prev_room != r:
                i, j = self.idx[prev_room], self.idx[r]
                self.counts[b, i, j] += 1
                if prev_epoch is not None:
                    dt = e["epoch"] - prev_epoch
                    if 1.0 < dt < 86400:  # sanity: between 1s and 24h
                        self._dwell_samples[(b, prev_room)].append(dt)
            prev_room, prev_epoch = r, e["epoch"]

    def finalize(self):
        n = len(self.rooms)

        # === Transition matrices with Laplace smoothing ===
        self.P = np.zeros_like(self.counts)
        for b in range(N_BUCKETS):
            smoothed = self.counts[b] + ALPHA
            self.P[b] = smoothed / smoothed.sum(axis=1, keepdims=True)

        # === Semi-Markov: fit log-normal dwell-time distributions ===
        self.dwell_dists = {}
        self.dwell_stats = {}  # fallback mean/std for serialization
        for key, samples in self._dwell_samples.items():
            if len(samples) >= MIN_DWELL_SAMPLES:
                samples_arr = np.array(samples)
                try:
                    shape, loc, scale = lognorm.fit(samples_arr, floc=0)
                    self.dwell_dists[key] = lognorm(shape, loc=0, scale=scale)
                    self.dwell_stats[key] = (float(shape), float(scale),
                                              float(np.mean(samples_arr)))
                except Exception:
                    # fit failed — fall back to empirical stats
                    self.dwell_stats[key] = (1.0, float(np.mean(samples)),
                                              float(np.mean(samples)))
            else:
                # too few samples — use a weak default prior (wide log-normal)
                self.dwell_stats[key] = (1.0, 300.0, 300.0)
        return self

    def save(self, path="model.npz"):
        np.savez(path,
                 rooms=np.array(self.rooms),
                 P=self.P,
                 dwell=json.dumps({f"{b}|{r}": v
                                   for (b, r), v in self.dwell_stats.items()}))

def load_days(path, days):
    by_day = {d: [] for d in days}
    with open(path) as f:
        for line in f:
            e = json.loads(line)
            d = e["ts"][:10]
            if d in by_day:
                by_day[d].append(e)
    return [sorted(v, key=lambda x: x["epoch"]) for v in by_day.values() if v]

def auto_select_train_days(path, min_events=100, max_days=60):
    """Auto-select training days with healthy event counts."""
    from collections import Counter
    counts = Counter()
    with open(path) as f:
        for line in f:
            e = json.loads(line)
            counts[e["ts"][:10]] += 1
    good = sorted([d for d, c in counts.items() if c >= min_events])
    # use the first max_days good days as training
    return good[:max_days]

if __name__ == "__main__":
    import sys
    data_path = sys.argv[1] if len(sys.argv) > 1 else "data/casas_clean.jsonl"

    train_days = auto_select_train_days(data_path)
    if not train_days:
        print("Error: No training days found. Make sure parsing succeeded.")
        sys.exit(1)
        
    days = load_days(data_path, train_days)
    rooms = {e["room"] for day in days for e in day}

    m = RoutineModel(rooms)
    for day in days:
        m.fit_day(day)
    m.finalize().save("model.npz")

    print(f"Trained on {len(days)} days, {len(rooms)} rooms.")
    print(f"Rooms: {sorted(rooms)}")
    print(f"Date range: {train_days[0]} → {train_days[-1]}")
    print(f"Dwell distributions fitted: "
          f"{sum(1 for v in m.dwell_stats.values() if v[2] != 300.0)}"
          f" / {len(m.dwell_stats)}")
    print("Saved model.npz")
