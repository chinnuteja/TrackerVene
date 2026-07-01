"use client";
import { motion } from "framer-motion";
import type { AbsenceEvent, BlindEvent } from "@/hooks/useRoutineFeed";
import { plainReason, liveState, worryMeaning, TONE_COLOR } from "@/lib/explain";

function fmt(s: number) { return s < 120 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`; }

type Props = {
  live:           { action: string; reason: string } | null;
  anomaly:        number;
  callPhase:      string;
  currentAbsence: AbsenceEvent | null;
  blind:          BlindEvent | null;
};

export function LiveRead({ live, anomaly, callPhase, currentAbsence, blind }: Props) {
  const { label, tone } = liveState(live?.action, !!currentAbsence, !!blind, callPhase);
  const color = TONE_COLOR[tone];

  const why = blind
    ? blind.msg
    : currentAbsence
      ? `Left the ${currentAbsence.from_room} — silent ${fmt(currentAbsence.silent_for)}; `
        + `normally something happens within ~${fmt(currentAbsence.expected_within)}.`
      : plainReason(live?.reason);

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <motion.div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          animate={{ opacity: tone === "calm" ? 1 : [1, 0.3, 1] }}
          transition={{ duration: 1.3, repeat: tone === "calm" ? 0 : Infinity }} />
        <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted)]">
          What’s happening
        </span>
      </div>

      {/* state, in plain words */}
      <motion.p key={label} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
        className="text-[15px] font-semibold leading-snug" style={{ color }}>
        {label}
      </motion.p>

      {/* why */}
      <p className="text-[12px] font-mono leading-relaxed mt-1 text-[var(--text)]">{why}</p>

      {/* the worry score, made legible */}
      <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <span className="text-[11px] font-mono text-[var(--muted)]">{worryMeaning(anomaly)}</span>
      </div>
    </div>
  );
}
