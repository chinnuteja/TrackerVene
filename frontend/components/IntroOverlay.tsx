"use client";
import { motion, AnimatePresence } from "framer-motion";

type Props = { onDismiss: () => void };

export function IntroOverlay({ onDismiss }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        key="intro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        style={{ background: "rgba(10,10,11,0.92)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          initial={{ y: 20, scale: 0.97 }}
          animate={{ y: 0,  scale: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 28 }}
          className="max-w-xl w-full rounded-2xl border p-8"
          style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        >
          {/* logo / wordmark */}
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "var(--accent)", color: "#0A0A0B" }}
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              ◉
            </motion.div>
            <div>
              <div className="text-base font-bold tracking-tight">Routine Topology Engine</div>
              <div className="text-xs text-[var(--muted)]">Ambient eldercare · Vene Health</div>
            </div>
          </div>

          {/* thesis */}
          <p className="text-lg font-semibold leading-snug mb-2" style={{ color: "var(--text)" }}>
            "Caring from a distance isn't really about the emergencies.
            <span style={{ color: "var(--accent)" }}> It's everything in between.</span>"
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
            This system learns the personal rhythm of a resident's day — the shape of an ordinary
            morning — and detects when that shape starts to bend. When it does, it doesn't alarm
            the family. It reaches out to the resident first, and only escalates if needed.
          </p>

          {/* three pillars */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { n: "01", label: "Behavioral",   desc: "Semi-Markov routine model + BOCD",     color: "var(--calm)"   },
              { n: "02", label: "Conversational",desc: "AI composes & interprets the call",   color: "var(--accent)" },
              { n: "03", label: "Memory",        desc: "Grows with every resolved incident",   color: "var(--warn)"   },
            ].map(({ n, label, desc, color }) => (
              <div
                key={n}
                className="rounded-lg border p-3"
                style={{ borderColor: color, background: "color-mix(in srgb, var(--panel) 80%, transparent)" }}
              >
                <div className="text-[10px] font-mono mb-1" style={{ color }}>PILLAR {n}</div>
                <div className="text-xs font-semibold mb-1" style={{ color }}>{label}</div>
                <div className="text-[10px] text-[var(--muted)] leading-snug">{desc}</div>
              </div>
            ))}
          </div>

          {/* demo tip */}
          <p className="text-[11px] text-[var(--muted)] mb-6 leading-snug">
            This build runs on a <span className="text-[var(--text)] font-semibold">real iPhone recording</span> of a home —
            no wall sensors, no wearable. Hit start and watch: the routine plays, then a fall is caught by the{" "}
            <span className="text-[var(--alarm)] font-semibold">silence</span> where movement should be, then the phone
            goes dark — which it refuses to read as “all-clear.”
          </p>

          {/* orientation — the last thing they read before clicking */}
          <div
            className="rounded-lg border px-3 py-2 mb-4"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}
          >
            <p className="text-[11px] leading-relaxed text-[var(--muted)]">
              <span className="font-semibold text-[var(--text)]">Compressed replay — not live.</span>{" "}
              ~11 min of real iPhone movement, played fast so you see the whole flow. The absence/fall
              and phone-off moments are staged to show the response.
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="w-full rounded-xl py-3 text-sm font-semibold tracking-wide
                       cursor-pointer transition-all"
            style={{ background: "var(--accent)", color: "#0A0A0B" }}
          >
            Start demo →
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
