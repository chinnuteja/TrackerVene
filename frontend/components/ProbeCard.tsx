"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { Probe, Resolution, Mode, CallPhase } from "@/hooks/useRoutineFeed";

// ── Typewriter ─────────────────────────────────────────────────────────────────
function Typewriter({ text, speed = 24 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span>{displayed}</span>;
}

// ── Waveform (equalizer bars) ──────────────────────────────────────────────────
function Waveform() {
  const bars = [0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 0.55];
  return (
    <div className="flex items-end gap-[3px] h-5">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-sm"
          style={{ background: "var(--accent)" }}
          animate={{ scaleY: [h * 0.4, h, h * 0.6, h * 0.9, h * 0.4] }}
          transition={{
            duration: 0.9 + i * 0.07,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.06,
          }}
        />
      ))}
    </div>
  );
}

// ── Shimmer row ────────────────────────────────────────────────────────────────
function Shimmer({ width = "60%" }: { width?: string }) {
  return (
    <motion.div
      className="h-3 rounded-full"
      style={{ width, background: "var(--border)" }}
      animate={{ opacity: [0.4, 0.85, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
type Props = {
  callPhase:  CallPhase;
  probe:      Probe | null;
  resolution: Resolution | null;
  mode:       Mode;
  answer:     (text: string) => void;
  name:       string;
};

// ── Component ──────────────────────────────────────────────────────────────────
export function ProbeCard({ callPhase, probe, resolution, mode, answer, name }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // reset dismissed whenever a new probe cycle starts
  useEffect(() => {
    if (callPhase === "composing" || callPhase === "ringing") {
      setDismissed(false);
    }
  }, [callPhase]);

  // auto-dismiss stand-down after 5s
  useEffect(() => {
    if (resolution?.stand_down) {
      const t = setTimeout(() => setDismissed(true), 5000);
      return () => clearTimeout(t);
    }
  }, [resolution]);

  const isActive = callPhase !== "idle" && !dismissed;

  // border / glow colour by phase
  const phaseColor =
    callPhase === "resolved"
      ? resolution?.stand_down
        ? "var(--calm)"
        : "var(--alarm)"
      : callPhase === "composing" || callPhase === "ringing"
        ? "var(--border)"
        : "var(--accent)";

  const glowShadow =
    callPhase === "resolved" && resolution && !resolution.stand_down
      ? `0 0 28px ${phaseColor}44`
      : callPhase === "calling" || callPhase === "listening"
        ? `0 0 16px ${"var(--accent)"}22`
        : "none";

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="probe-card"
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="rounded-xl border p-4"
          style={{
            borderColor: phaseColor,
            background: "var(--panel)",
            boxShadow: glowShadow,
          }}
        >
          {/* ── COMPOSING ─────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {callPhase === "composing" && (
              <motion.div
                key="composing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                <p className="text-[10px] font-mono tracking-widest text-[var(--muted)] mb-3">
                  VENE AI
                </p>
                <div className="flex flex-col gap-2">
                  <Shimmer width="70%" />
                  <Shimmer width="50%" />
                  {probe?.reason && (
                    <p className="text-[11px] text-[var(--muted)] mt-1">
                      triggered by: {probe.reason}
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mt-3">Composing a check-in for {name}…</p>
              </motion.div>
            )}

            {/* ── RINGING ───────────────────────────────────────────────── */}
            {callPhase === "ringing" && (
              <motion.div
                key="ringing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
                className="flex items-center gap-3"
              >
                <motion.span
                  className="text-xl"
                  animate={{ rotate: [-8, 8, -8] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  📞
                </motion.span>
                <div>
                  <p className="text-xs font-semibold tracking-widest" style={{ color: "var(--accent)" }}>
                    CALLING {name.toUpperCase()}…
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">ringing</p>
                </div>
              </motion.div>
            )}

            {/* ── CALLING (script types in) ─────────────────────────────── */}
            {(callPhase === "calling" || callPhase === "listening") && probe && (
              <motion.div
                key="calling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                {/* header */}
                <div className="flex items-center gap-2 mb-3">
                  <motion.span
                    className="text-base"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    📞
                  </motion.span>
                  <span
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: "var(--accent)" }}
                  >
                    VENE IS CALLING {name.toUpperCase()}…
                  </span>
                  {probe.source === "llm" && (
                    <span
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border font-mono"
                      style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
                    >
                      AI
                    </span>
                  )}
                </div>

                {/* script */}
                <p className="text-sm text-[var(--text)] leading-relaxed mb-3 italic">
                  &ldquo;<Typewriter text={probe.script} speed={22} />&rdquo;
                </p>

                {/* waveform row (listening phase) */}
                {callPhase === "listening" && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <Waveform />
                    <span className="text-[11px] text-[var(--muted)]">Listening to {name}…</span>
                  </div>
                )}

                {/* interactive answer buttons (calling + listening only) */}
                {mode === "interactive" && (
                  <div className="flex gap-2 mt-3">
                    {[
                      { label: "I'm fine",          val: "I am fine dear, just needed some water.", color: "var(--calm)"  },
                      { label: "Something's wrong",  val: "I keep having pain and I'm not feeling well.", color: "var(--alarm)" },
                      { label: "No answer",          val: "",                                        color: "var(--muted)" },
                    ].map(({ label, val, color }) => (
                      <button
                        key={label}
                        onClick={() => answer(val)}
                        className="flex-1 rounded-lg border py-2 px-3 text-xs font-semibold transition-colors cursor-pointer"
                        style={{ borderColor: color, color, background: "transparent" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── INTERPRETING ──────────────────────────────────────────── */}
            {callPhase === "interpreting" && (
              <motion.div
                key="interpreting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                <p className="text-[10px] font-mono tracking-widest text-[var(--muted)] mb-3">
                  INTERPRETING REPLY…
                </p>
                <div className="flex flex-col gap-2">
                  <Shimmer width="55%" />
                  <Shimmer width="40%" />
                </div>
              </motion.div>
            )}

            {/* ── RESOLVED ──────────────────────────────────────────────── */}
            {callPhase === "resolved" && resolution && (
              <motion.div
                key="resolved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                {/* header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold tracking-widest" style={{ color: phaseColor }}>
                    {resolution.stand_down ? "STOOD DOWN" : "ESCALATING"}
                  </span>
                </div>

                {/* transcript */}
                {resolution.transcript && (
                  <p className="text-sm text-[var(--muted)] italic mb-2">
                    {name}: &ldquo;<Typewriter text={resolution.transcript} speed={18} />&rdquo;
                  </p>
                )}

                {/* rationale */}
                <p className="text-sm leading-snug" style={{ color: phaseColor }}>
                  {resolution.rationale}
                </p>

                <button
                  onClick={() => setDismissed(true)}
                  className="mt-3 text-[10px] text-[var(--muted)] underline cursor-pointer"
                >
                  dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
