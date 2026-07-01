"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { BlindEvent } from "@/hooks/useRoutineFeed";

// The observability beat: the phone went dark. Amber, distinct from the red absence alert —
// this is "I can't see," NOT "something's wrong" and NOT "all clear".
export function BlindAlert({ blind }: { blind: BlindEvent | null }) {
  return (
    <AnimatePresence>
      {blind && (
        <motion.div
          key="blind-alert"
          initial={{ opacity: 0, y: -8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="rounded-2xl border-2 p-4"
          style={{
            borderColor: "var(--warn)",
            background: "color-mix(in srgb, var(--warn) 14%, var(--panel))",
            boxShadow: "0 0 0 1px var(--warn), 0 0 18px color-mix(in srgb, var(--warn) 35%, transparent)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: "var(--warn)", boxShadow: "0 0 8px var(--warn)" }}
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[13px] font-bold tracking-wide text-[var(--warn)]">
              ⚠ Visibility Lost — NOT “All Clear”
            </span>
          </div>

          <p className="text-[12px] font-mono leading-relaxed" style={{ color: "var(--text)" }}>
            {blind.msg}
          </p>

          <p className="text-[11px] font-mono leading-relaxed mt-2 text-[var(--muted)]">
            Last seen in the{" "}
            <span style={{ color: "var(--warn)" }}>{blind.from_room}</span>. A weaker system
            would go quiet here and that reads as fine — so instead it escalates to family to
            check in person.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
