"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { AbsenceEvent } from "@/hooks/useRoutineFeed";

function fmt(seconds: number) {
  if (seconds < 120) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

export function AbsenceAlert({ absence }: { absence: AbsenceEvent | null }) {
  return (
    <AnimatePresence>
      {absence && (
        <motion.div
          key="absence-alert"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--alarm)",
            background:  "color-mix(in srgb, var(--alarm) 8%, var(--panel))",
          }}
        >
          {/* header row */}
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: "var(--alarm)", boxShadow: "0 0 6px var(--alarm)" }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[10px] font-mono tracking-widest text-[var(--alarm)] uppercase">
              No Movement Detected
            </span>
          </div>

          {/* main message */}
          <p className="text-[12px] font-mono leading-relaxed" style={{ color: "var(--text)" }}>
            Left the{" "}
            <span style={{ color: "var(--alarm)" }}>{absence.from_room}</span>
            {" "}and hasn&apos;t appeared anywhere.{" "}
            {absence.within_room
              ? "No new movement inside the room either."
              : "Expected to arrive somewhere within ~" + fmt(absence.expected_within) + "."}
          </p>

          {/* stat row */}
          <div className="flex gap-4 mt-3">
            <div>
              <div className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">Silent for</div>
              <div className="text-[13px] font-mono" style={{ color: "var(--alarm)" }}>
                {fmt(absence.silent_for)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">Normal gap</div>
              <div className="text-[13px] font-mono text-[var(--muted)]">
                ~{fmt(absence.expected_within)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">From</div>
              <div className="text-[13px] font-mono" style={{ color: "var(--warn)" }}>
                {absence.from_room}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
