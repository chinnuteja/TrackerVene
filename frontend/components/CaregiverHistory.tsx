"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { Incident } from "@/hooks/useRoutineFeed";

const KIND_CONFIG: Record<string, { label: string; color: string }> = {
  uti:        { label: "UTI / bathroom", color: "var(--alarm)" },
  wandering:  { label: "Night wandering", color: "var(--alarm)" },
  depressive: { label: "Low mood",        color: "var(--warn)"  },
  calm:       { label: "Routine",          color: "var(--calm)"  },
};

function fmtTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return ts.slice(11, 16); }
}

function fmtDate(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return ts.slice(0, 10); }
}

type Props = { incidents: Incident[] };

export function CaregiverHistory({ incidents }: Props) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col"
      style={{ borderColor: "var(--border)", background: "var(--panel)" }}
    >
      <span className="text-[10px] font-semibold tracking-widest text-[var(--muted)] mb-1">
        CAREGIVER HISTORY
      </span>
      <p className="text-[10px] text-[var(--muted)] mb-3">
        Incidents Sarah would see — each one saved to Mary&apos;s profile.
      </p>

      {incidents.length === 0 && (
        <p className="text-xs text-[var(--muted)]">No incidents recorded yet.</p>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-40 pr-1">
        <AnimatePresence initial={false}>
          {incidents.map((inc, i) => {
            const cfg = KIND_CONFIG[inc.kind] ?? { label: inc.kind, color: "var(--muted)" };
            return (
              <motion.div
                key={inc.ts + i}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="flex items-start gap-3"
              >
                {/* timeline dot */}
                <div className="flex flex-col items-center pt-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: cfg.color }}
                  />
                  {i < incidents.length - 1 && (
                    <div
                      className="w-px flex-1 mt-1"
                      style={{ background: "var(--border)", minHeight: 14 }}
                    />
                  )}
                </div>

                {/* text */}
                <div className="pb-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {fmtDate(inc.ts)} · {fmtTime(inc.ts)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-snug">
                    {inc.summary}
                  </p>
                  <p className="text-[11px] leading-snug mt-0.5" style={{ color: cfg.color }}>
                    {inc.resolution}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
