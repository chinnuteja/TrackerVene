from brain.conversation import compose_checkin

T_WATCH = 4.0
T_PROBE = 8.0
T_CALL  = 14.0

DRIFT_THRESHOLD_REDUCTION = 0.6  # multiply thresholds by this when regime_shift detected


class Agent:
    def __init__(self, memory: dict = None):
        self.memory = memory or {}
        self.last_action = "observe"
        self.probe_pending = False
        self.probe_unanswered_streak = 0

    def decide(self, score_obj, changepoint_obj, event):
        a = score_obj["anomaly"]
        reason = score_obj["reason"]
        hour = int(event["ts"][11:13])
        stability = changepoint_obj["stability"]
        change_prob = changepoint_obj["change_prob"]

        drift_factor = DRIFT_THRESHOLD_REDUCTION if stability == "regime_shift" else 1.0
        t_watch = T_WATCH * drift_factor
        t_probe = T_PROBE * drift_factor
        t_call  = T_CALL  * drift_factor

        if a < t_watch:
            self.probe_pending = False
            self.probe_unanswered_streak = 0
            return self._mk("observe", a, reason, stability, change_prob,
                            "Routine within normal bounds. Staying invisible.")

        if a < t_probe:
            if stability == "regime_shift":
                call = compose_checkin(reason, hour, self.memory, stability)
                self.probe_pending = True
                return self._mk("soft_checkin", a, reason, stability, change_prob,
                                call["script"], probe=True,
                                script=call["script"], script_source=call["source"])
            return self._mk("ambient_nudge", a, reason, stability, change_prob,
                            "Mild deviation detected. Raising kitchen lights as a "
                            "soft environmental cue — no interruption needed.")

        if a < t_call or not self.probe_pending:
            call = compose_checkin(reason, hour, self.memory, stability)
            self.probe_pending = True
            return self._mk("soft_checkin", a, reason, stability, change_prob,
                            call["script"], probe=True,
                            script=call["script"], script_source=call["source"])

        self.probe_unanswered_streak += 1
        return self._mk("escalate_caregiver", a, reason, stability, change_prob,
                        "Sustained deviation and unanswered check-in. Alerting "
                        "caregiver with full evidence trail.", escalate=True)

    def resolve_probe(self, verdict: str) -> dict:
        """
        Consume a verdict from interpret_reply and return delta + stand_down.
        Replaces the dead boolean resolve_probe(answered_ok).
        """
        if verdict == "reassuring":
            self.probe_pending = False
            self.probe_unanswered_streak = 0
            return {"delta": -6.0, "stand_down": True}
        elif verdict == "worrying":
            # leave probe_pending armed → next decide() can escalate
            self.probe_unanswered_streak += 1
            return {"delta": +5.0, "stand_down": False}
        else:  # no_answer
            self.probe_unanswered_streak += 1
            return {"delta": +4.0, "stand_down": False}

    def _mk(self, action, anomaly, reason, stability, change_prob,
            explanation, probe=False, escalate=False,
            script=None, script_source=None):
        d = {
            "action": action,
            "anomaly": round(anomaly, 2),
            "trigger": reason,
            "explanation": explanation,
            "stability": stability,
            "change_prob": round(change_prob, 3),
            "is_probe": probe,
            "is_escalation": escalate,
        }
        if script is not None:
            d["script"] = script
            d["script_source"] = script_source
        return d
