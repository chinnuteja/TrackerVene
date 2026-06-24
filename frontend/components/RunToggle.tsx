"use client";
import { motion } from "framer-motion";
import type { Scenario } from "@/hooks/useRoutineFeed";

type Props = {
  scenario:    Scenario;
  setScenario: (s: Scenario) => void;
};

export function RunToggle({ scenario, setScenario }: Props) {
  const isCalm = scenario === "calm";

  return (
    <div
      className="flex items-center gap-1 rounded-lg border p-0.5"
      style={{ borderColor: "var(--border)", background: "var(--panel)" }}
    >
      {(["calm", "uti"] as const).map(s => {
        const active = scenario === s;
        const color  = s === "calm" ? "var(--calm)" : "var(--alarm)";
        return (
          <motion.button
            key={s}
            onClick={() => setScenario(s)}
            className="relative px-3 py-1 rounded-md text-xs font-semibold tracking-wide
                       cursor-pointer transition-colors"
            style={{
              color:      active ? (s === "calm" ? "#0A0A0B" : "#0A0A0B") : "var(--muted)",
              background: "transparent",
              zIndex:     1,
            }}
          >
            {active && (
              <motion.div
                layoutId="run-toggle-bg"
                className="absolute inset-0 rounded-md"
                style={{ background: color }}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <span className="relative z-10">
              {s === "calm" ? "CALM" : "ANOMALY"}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
