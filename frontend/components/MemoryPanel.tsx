"use client";
import { motion } from "framer-motion";
import type { MemoryState } from "@/hooks/useRoutineFeed";

type Props = {
  memory:      MemoryState | null;
  latestProbe?: string;  // used to highlight which detail was referenced
};

export function MemoryPanel({ memory, latestProbe }: Props) {
  if (!memory) return null;

  // Extract personal_details from the brief using a simple heuristic
  const detailsMatch = memory.brief.match(/Personal details: (.+?)\./);
  const details: string[] = detailsMatch
    ? detailsMatch[1].split(";").map(d => d.trim()).filter(Boolean)
    : [];

  function isHighlighted(detail: string) {
    if (!latestProbe) return false;
    // highlight if any key word from the detail appears in the probe script
    return detail.split(" ").some(w => w.length > 4 && latestProbe.toLowerCase().includes(w.toLowerCase()));
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--panel)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold tracking-widest text-[var(--muted)]">
          WHAT VENE REMEMBERS ABOUT MARY
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full border font-mono"
          style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
        >
          {memory.incidents.length} incident{memory.incidents.length !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[10px] text-[var(--muted)] mb-3">
        Personal profile injected into every AI call — Vene pillar 3.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {details.map((detail, i) => {
          const lit = isHighlighted(detail);
          return (
            <motion.span
              key={i}
              animate={lit ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.6 }}
              className="text-[11px] px-2 py-0.5 rounded-full border"
              style={{
                borderColor: lit ? "var(--accent)" : "var(--border)",
                color:       lit ? "var(--accent)" : "var(--muted)",
                background:  lit
                  ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                  : "transparent",
              }}
            >
              {detail}
            </motion.span>
          );
        })}
        {details.length === 0 && (
          <span className="text-xs text-[var(--muted)]">{memory.brief}</span>
        )}
      </div>
    </div>
  );
}
