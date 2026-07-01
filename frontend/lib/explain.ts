// Turn the engine's raw signals into plain English a person watching the UI can understand.
// Pure functions, no state. Thresholds mirror backend/brain/agent.py (T_WATCH 4 / T_PROBE 8 / T_CALL 14).

export type Tone = "calm" | "watch" | "alert" | "blind";

export function plainReason(reason?: string): string {
  if (!reason || reason === "routine") return "moving normally between rooms";
  if (reason.startsWith("rare_transition:")) {
    const body = reason.slice("rare_transition:".length).split("@")[0];
    const [a, b] = body.split("->");
    return `an unusual move from the ${a} to the ${b} for this time of day`;
  }
  if (reason.startsWith("dwell_anomaly:")) {
    const room = reason.split(":")[1] ?? "room";
    return `stayed in the ${room} longer or shorter than her normal`;
  }
  if (reason === "unknown_room") return "an unrecognised place";
  return "a change from her usual pattern";
}

export function liveState(
  action: string | undefined,
  hasAbsence: boolean,
  isBlind: boolean,
  callPhase: string,
): { label: string; tone: Tone } {
  if (isBlind)    return { label: "Can’t see her — phone went dark", tone: "blind" };
  if (hasAbsence) return { label: "Unexpected silence — checking on her", tone: "alert" };
  if (action === "escalate_caregiver") return { label: "Alerting family — no answer", tone: "alert" };
  if (action === "soft_checkin" || (callPhase !== "idle" && callPhase !== "resolved"))
    return { label: "Checking in on her", tone: "watch" };
  if (action === "ambient_nudge") return { label: "Noticing a mild change", tone: "watch" };
  return { label: "Calm — moving like her normal self", tone: "calm" };
}

export function worryMeaning(anomaly: number): string {
  const a = Math.round((anomaly ?? 0) * 10) / 10;
  if (anomaly < 4)  return `Worry ${a}/14 — low, nothing to do`;
  if (anomaly < 8)  return `Worry ${a}/14 — mild, just watching`;
  if (anomaly < 14) return `Worry ${a}/14 — high enough to check in`;
  return `Worry ${a}/14 — alerting family`;
}

export const TONE_COLOR: Record<Tone, string> = {
  calm:  "var(--calm)",
  watch: "var(--warn)",
  alert: "var(--alarm)",
  blind: "var(--warn)",
};
