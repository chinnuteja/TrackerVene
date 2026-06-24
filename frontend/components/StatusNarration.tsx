"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { CallPhase } from "@/hooks/useRoutineFeed";

type Props = {
  anomaly:    number | undefined;
  callPhase:  CallPhase;
  stability:  "stable" | "possible_drift" | "regime_shift" | undefined;
  name:       string;
  lastStandDown?: boolean;
};

type NarrationState = { text: string; color: string; key: string };

function getNarration(
  anomaly: number,
  callPhase: CallPhase,
  stability: string,
  name: string,
  lastStandDown?: boolean,
): NarrationState {
  const activeCallPhases: CallPhase[] = ["composing", "ringing", "calling", "listening", "interpreting"];

  if (activeCallPhases.includes(callPhase)) {
    return {
      text:  `Vene is on a call with ${name}.`,
      color: "var(--accent)",
      key:   "on-call",
    };
  }
  if (callPhase === "resolved") {
    if (lastStandDown) {
      return {
        text:  `${name} is fine — Vene stood down.`,
        color: "var(--calm)",
        key:   "stood-down",
      };
    }
    return {
      text:  "Escalated to caregiver with the full evidence trail.",
      color: "var(--alarm)",
      key:   "escalated",
    };
  }
  if (stability === "regime_shift" || anomaly >= 8) {
    return {
      text:  `Routine has shifted — Vene is paying close attention.`,
      color: "var(--alarm)",
      key:   "regime-shift",
    };
  }
  if (anomaly >= 4) {
    return {
      text:  "Something looks slightly off — watching closely.",
      color: "var(--warn)",
      key:   "watching",
    };
  }
  return {
    text:  "All calm — Vene is observing quietly.",
    color: "var(--calm)",
    key:   "calm",
  };
}

export function StatusNarration({ anomaly, callPhase, stability, name, lastStandDown }: Props) {
  const { text, color, key } = getNarration(anomaly ?? 0, callPhase, stability ?? "stable", name, lastStandDown);

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      {/* status dot */}
      <AnimatePresence mode="wait">
        <motion.div
          key={key + "-dot"}
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: `0 0 5px ${color}88` }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        />
      </AnimatePresence>

      {/* narration text */}
      <AnimatePresence mode="wait">
        <motion.span
          key={key}
          className="text-[11px] font-mono"
          style={{ color }}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 4 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
