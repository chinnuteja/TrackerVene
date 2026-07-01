"""Build a PERSONAL routine model from the resident's own iPhone data.

This replaces Mary's CASAS `model.npz` with a model of *this* home — same shape, so the
engine (recipe) is unchanged, only the ingredient is the resident's. Day-1 cold-start:
rooms + transitions come from the real walk; "how long is normal" starts from the observed
dwells blended with a sensible prior and sharpens as more days are added.

Usage:  python -m ingestion.build_personal_model
Output: backend/model_iphone.npz   (keys: rooms, P, dwell — identical format to model.npz)
"""
import json, numpy as np, pathlib
from collections import defaultdict

HERE   = pathlib.Path(__file__).resolve().parent
BACKEND = HERE.parent
ROUTINE = BACKEND / "data" / "casas_iphone_realday.jsonl"
OUT     = BACKEND / "model_iphone.npz"

ROOMS      = ["Main Bedroom", "Second Bedroom", "Kitchen", "Bathroom", "Hall"]
N          = len(ROOMS)
IDX        = {r: i for i, r in enumerate(ROOMS)}
N_BUCKETS  = 8
DWELL_SHAPE = 0.6          # log-normal spread; moderate
DWELL_PRIOR = 90.0         # seconds — sensible default until more data sharpens it


def build():
    evs = [json.loads(l) for l in open(ROUTINE, encoding="utf-8") if l.strip()]
    dwell_evs = [e for e in evs if e.get("kind") == "motion"]

    # transitions: strong weight on the observed walk (day-1 it IS the routine) + small prior
    counts = np.full((N, N), 0.25)
    dwell_by_room = defaultdict(list)
    prev = None
    for e in dwell_evs:
        r = e["room"]
        if r not in IDX:
            continue
        if prev is not None and prev != r:
            counts[IDX[prev], IDX[r]] += 3.0
        g = float(e.get("_dwell_s", 0))
        if 0 < g <= 300:                # exclude the injected fall (outlier) — learn only nominal
            dwell_by_room[r].append(g)
        prev = r
    P1 = counts / counts.sum(axis=1, keepdims=True)
    P  = np.repeat(P1[None, :, :], N_BUCKETS, axis=0)

    # dwell: fit per-room mean from the real gaps the engine will see; floor for stability
    dwell = {}
    for r in ROOMS:
        vals = dwell_by_room.get(r, [])
        mean = max(float(np.mean(vals)) if vals else DWELL_PRIOR, 30.0)
        for b in range(N_BUCKETS):
            dwell[f"{b}|{r}"] = [DWELL_SHAPE, mean, mean]   # [shape, scale, mean]

    np.savez(OUT, rooms=np.array(ROOMS, dtype=object), P=P,
             dwell=np.array(json.dumps(dwell)))
    print("personal model ->", OUT.name)
    print("  rooms:", ROOMS)
    print("  transition probs (row=from):")
    for i, r in enumerate(ROOMS):
        row = " ".join(f"{ROOMS[j][:4]}:{P1[i,j]:.2f}" for j in range(N))
        print(f"    {r:<15} {row}")
    print("  dwell means (s):", {r: round(np.mean(dwell_by_room.get(r,[DWELL_PRIOR])),0) for r in ROOMS})


if __name__ == "__main__":
    build()
