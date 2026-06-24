import numpy as np
from scipy.stats import norm

class BayesianChangepoint:
    """Bayesian Online Changepoint Detection (Adams & MacKay, 2007).

    Maintains a distribution over 'run lengths' — how many observations
    since the last regime change. When mass shifts to short run lengths,
    a changepoint has been detected.
    """

    def __init__(self, hazard_rate=1/200, mu0=1.0, kappa0=1.0,
                 alpha0=1.0, beta0=1.0):
        """
        hazard_rate: prior probability of changepoint at each step.
                     1/200 means we expect a regime change every ~200 events.
        mu0, kappa0, alpha0, beta0: Normal-Inverse-Gamma prior hyperparameters
                                      for the predictive distribution.
        """
        self.hazard = hazard_rate

        # Sufficient statistics for the Normal-Inverse-Gamma posterior
        # One set per possible run length
        self.mu0 = mu0
        self.kappa0 = kappa0
        self.alpha0 = alpha0
        self.beta0 = beta0

        # Initialize: single run of length 0
        self.run_length_probs = np.array([1.0])
        self.mu = np.array([mu0])
        self.kappa = np.array([kappa0])
        self.alpha = np.array([alpha0])
        self.beta = np.array([beta0])

    def update(self, observation):
        """Process one observation (a surprisal value) and return changepoint info."""
        n = len(self.run_length_probs)

        # === Predictive probability under each run length ===
        # Using Student-t predictive (Normal-Inverse-Gamma conjugate)
        pred_variance = self.beta * (self.kappa + 1) / (self.alpha * self.kappa)
        pred_std = np.sqrt(np.maximum(pred_variance, 1e-10))
        pred_probs = norm.pdf(observation, loc=self.mu, scale=pred_std)
        pred_probs = np.maximum(pred_probs, 1e-300)

        # === Growth probabilities: run continues ===
        growth = self.run_length_probs * pred_probs * (1 - self.hazard)

        # === Changepoint probability: new run starts ===
        changepoint_mass = np.sum(self.run_length_probs * pred_probs * self.hazard)

        # === Update run-length distribution ===
        new_probs = np.empty(n + 1)
        new_probs[0] = changepoint_mass
        new_probs[1:] = growth
        total = new_probs.sum()
        if total > 0:
            new_probs /= total
        self.run_length_probs = new_probs

        # === Update sufficient statistics ===
        # For continuing runs: incorporate new observation
        new_mu = np.empty(n + 1)
        new_kappa = np.empty(n + 1)
        new_alpha = np.empty(n + 1)
        new_beta = np.empty(n + 1)

        # New run (changepoint): reset to prior
        new_mu[0] = self.mu0
        new_kappa[0] = self.kappa0
        new_alpha[0] = self.alpha0
        new_beta[0] = self.beta0

        # Existing runs: Bayesian update
        new_kappa[1:] = self.kappa + 1
        new_mu[1:] = (self.kappa * self.mu + observation) / new_kappa[1:]
        new_alpha[1:] = self.alpha + 0.5
        new_beta[1:] = (self.beta +
                        self.kappa * (observation - self.mu)**2 / (2 * new_kappa[1:]))

        self.mu = new_mu
        self.kappa = new_kappa
        self.alpha = new_alpha
        self.beta = new_beta

        # === Prune for efficiency: keep max 300 run lengths ===
        if len(self.run_length_probs) > 300:
            self.run_length_probs = self.run_length_probs[:300]
            self.run_length_probs /= self.run_length_probs.sum()
            self.mu = self.mu[:300]
            self.kappa = self.kappa[:300]
            self.alpha = self.alpha[:300]
            self.beta = self.beta[:300]

        return self.get_state()

    def get_state(self):
        """Return current changepoint detection state."""
        # Probability of a recent changepoint (mass on short run lengths)
        recent_change_prob = float(self.run_length_probs[:10].sum())
        # Most likely current run length
        map_run_length = int(np.argmax(self.run_length_probs))
        # Stability: how concentrated is the mass?
        max_prob = float(self.run_length_probs.max())

        if recent_change_prob > 0.5:
            status = "regime_shift"
        elif recent_change_prob > 0.2:
            status = "possible_drift"
        else:
            status = "stable"

        return {
            "change_prob": round(recent_change_prob, 3),
            "run_length": map_run_length,
            "stability": status,
            "confidence": round(max_prob, 3)
        }
