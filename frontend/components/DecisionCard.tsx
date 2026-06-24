import { motion } from "framer-motion";
import type { Decision } from "@/hooks/useRoutineFeed";

const STYLE: Record<Decision["action"], { label: string; color: string }> = {
  observe:             { label: "OBSERVING",  color: "var(--calm)" },
  ambient_nudge:       { label: "SOFT CUE",   color: "var(--accent)" },
  soft_checkin:        { label: "CHECK-IN",   color: "var(--warn)" },
  escalate_caregiver:  { label: "ESCALATING", color: "var(--alarm)" },
};

const STABILITY_BADGE: Record<string, { label: string; color: string }> = {
  stable:         { label: "STABLE",  color: "var(--calm)" },
  possible_drift: { label: "DRIFT",   color: "var(--warn)" },
  regime_shift:   { label: "SHIFT",   color: "var(--alarm)" },
};

export function DecisionCard({ d }: { d: Decision }) {
  const s = STYLE[d.action];
  const sb = STABILITY_BADGE[d.stability] || STABILITY_BADGE.stable;
  return (
    <motion.div
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="rounded-xl border p-4 mb-3"
      style={{ borderColor: s.color,
               boxShadow: d.is_escalation ? `0 0 20px ${s.color}55` : "none",
               background: "var(--panel)" }}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold tracking-widest"
              style={{ color: s.color }}>{s.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                style={{ color: sb.color, borderColor: sb.color }}>
            {sb.label}
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            a={d.anomaly.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="text-xs text-[var(--muted)] mb-2 font-mono">{d.trigger}</div>
      <p className="text-sm text-[var(--text)] leading-snug">{d.explanation}</p>
    </motion.div>
  );
}
