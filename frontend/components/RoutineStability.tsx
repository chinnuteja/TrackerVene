import { motion } from "framer-motion";
import type { ChangepointState } from "@/hooks/useRoutineFeed";

const STATUS_CONFIG = {
  stable:         { label: "STABLE",        color: "var(--calm)",  icon: "◉",
                    desc: "Routine is consistent with baseline." },
  possible_drift: { label: "POSSIBLE DRIFT", color: "var(--warn)",  icon: "◎",
                    desc: "Pattern deviation detected — monitoring closely." },
  regime_shift:   { label: "REGIME SHIFT",   color: "var(--alarm)", icon: "⊘",
                    desc: "Routine has structurally changed from baseline." },
};

export function RoutineStability({ state }: { state: ChangepointState }) {
  const config = STATUS_CONFIG[state.stability];

  return (
    <motion.div
      className="rounded-xl border p-4"
      style={{ borderColor: config.color, background: "var(--panel)" }}
      animate={{ boxShadow: state.stability === "regime_shift"
        ? `0 0 20px ${config.color}33` : "none" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-widest"
              style={{ color: config.color }}>
          ROUTINE STABILITY
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--muted)]">
            confidence {Math.round((state.confidence ?? 0) * 100)}%
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            Δ={state.change_prob.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <motion.span
          className="text-2xl"
          style={{ color: config.color }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {config.icon}
        </motion.span>
        <div>
          <div className="text-sm font-semibold" style={{ color: config.color }}>
            {config.label}
          </div>
          <div className="text-xs text-[var(--muted)]">{config.desc}</div>
        </div>
      </div>

      {/* Run length bar: how long since last detected change */}
      <div className="mt-2">
        <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
          <span>Run length</span>
          <span className="font-mono">{state.run_length} events</span>
        </div>
        <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: config.color }}
            animate={{ width: `${Math.min(state.run_length / 200 * 100, 100)}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
