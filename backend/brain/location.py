import numpy as np


class LocationBelief:
    """
    Probabilistic belief over rooms using the learned transition matrix.

    After observe(room): mass concentrates on that room (high confidence).
    Under silence:       predict(bucket) diffuses the belief via b = b @ P[bucket],
                         so confidence degrades as the person could be anywhere.
    """

    def __init__(self, rooms: list, P: np.ndarray):
        self.rooms = rooms
        self.n     = len(rooms)
        self.idx   = {r: i for i, r in enumerate(rooms)}
        self.P     = P          # shape (8, n, n)
        # uniform prior until first observation
        self.b = np.ones(self.n) / self.n

    def observe(self, room: str):
        """Sensor fired in `room` — concentrate mass there."""
        if room not in self.idx:
            return
        b = np.zeros(self.n)
        b[self.idx[room]] = 1.0
        self.b = b

    def predict(self, bucket: int, steps: int = 1):
        """Diffuse belief forward `steps` time-steps using P[bucket]."""
        steps = min(steps, 8)          # cap diffusion — beyond 8 steps it's noise
        Pb = self.P[bucket % 8]
        b  = self.b.copy()
        for _ in range(steps):
            b = b @ Pb
        self.b = b / (b.sum() + 1e-12)

    def state(self) -> dict:
        """Return best room, confidence (0-1), and top-3 belief breakdown."""
        best_i      = int(np.argmax(self.b))
        confidence  = float(self.b[best_i])
        top3_idx    = np.argsort(self.b)[::-1][:3]
        belief_map  = {self.rooms[i]: round(float(self.b[i]), 3) for i in top3_idx}
        return {
            "best":       self.rooms[best_i],
            "confidence": round(confidence, 3),
            "belief":     belief_map,
        }
