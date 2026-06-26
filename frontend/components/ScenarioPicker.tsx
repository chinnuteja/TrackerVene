"use client";
import { motion } from "framer-motion";
import type { Scenario, Mode } from "@/hooks/useRoutineFeed";

const SCENARIOS: { id: Scenario; label: string; desc: string; multi?: boolean; hero?: boolean }[] = [
  { id: "uti",                label: "UTI",          desc: "Nocturnal bathroom trips" },
  { id: "wandering",          label: "Wandering",    desc: "3am front-door egress" },
  { id: "depressive",         label: "Low mood",     desc: "No morning kitchen routine" },
  { id: "hallway_fall",       label: "Hallway fall", desc: "Fall between rooms — no sensor needed", hero: true },
  { id: "uti_multiday",       label: "UTI ×3d",      desc: "3-day ramping UTI arc",     multi: true },
  { id: "wandering_multiday", label: "Wander ×3d",   desc: "3-day wandering arc",       multi: true },
  { id: "depressive_multiday",label: "Low ×3d",      desc: "3-day low mood arc",        multi: true },
];

const MODES: { id: Mode; label: string }[] = [
  { id: "auto",        label: "Auto" },
  { id: "interactive", label: "Interactive" },
];

type Props = {
  scenario:    Scenario;
  setScenario: (s: Scenario) => void;
  mode:        Mode;
  setMode:     (m: Mode) => void;
  disabled?:   boolean;  // disable when in calm run
};

export function ScenarioPicker({ scenario, setScenario, mode, setMode, disabled }: Props) {
  return (
    <div className="flex items-center gap-3">
      {/* Scenario chips — single-day */}
      <div className="flex gap-1.5">
        {SCENARIOS.filter(s => !s.multi).map(({ id, label, desc, hero }) => {
          const active    = scenario === id;
          const chipColor = hero ? "var(--alarm)" : "var(--warn)";
          return (
            <motion.button
              key={id}
              title={desc}
              disabled={disabled}
              onClick={() => setScenario(id)}
              whileHover={{ scale: disabled ? 1 : 1.04 }}
              whileTap={{ scale: disabled ? 1 : 0.97 }}
              className="px-2.5 py-1 rounded-md border text-[11px] font-semibold
                         tracking-wide cursor-pointer transition-all"
              style={{
                borderColor: active ? chipColor : "var(--border)",
                color:       active ? chipColor : "var(--muted)",
                background:  active ? `color-mix(in srgb, ${chipColor} 10%, transparent)` : "transparent",
                opacity:     disabled ? 0.35 : 1,
                cursor:      disabled ? "not-allowed" : "pointer",
              }}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* divider */}
      <div className="w-px h-4 self-center" style={{ background: "var(--border)" }} />

      {/* Scenario chips — multi-day */}
      <div className="flex gap-1.5">
        {SCENARIOS.filter(s => s.multi).map(({ id, label, desc }) => {
          const active = scenario === id;
          return (
            <motion.button
              key={id}
              title={`3-day arc: ${desc}`}
              disabled={disabled}
              onClick={() => setScenario(id)}
              whileHover={{ scale: disabled ? 1 : 1.04 }}
              whileTap={{ scale: disabled ? 1 : 0.97 }}
              className="px-2.5 py-1 rounded-md border text-[11px] font-semibold
                         tracking-wide cursor-pointer transition-all"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                color:       active ? "var(--accent)" : "var(--muted)",
                background:  active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                opacity:     disabled ? 0.35 : 1,
                cursor:      disabled ? "not-allowed" : "pointer",
              }}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* Mode switch */}
      <div
        className="flex items-center gap-1 rounded-md border p-0.5"
        style={{ borderColor: "var(--border)" }}
      >
        {MODES.map(({ id, label }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wide
                         transition-colors cursor-pointer"
              style={{
                background: active ? "var(--border)" : "transparent",
                color:      active ? "var(--text)"   : "var(--muted)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
