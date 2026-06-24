"use client";
import { motion } from "framer-motion";

const GAUGE_MAX  = 14;
const CALL_LEVEL = 8;

type DataPoint = { t: string; a: number };

function anomalyColor(a: number) {
  const pct = Math.min(a / GAUGE_MAX, 1);
  if (pct < 0.28) return "var(--calm)";
  if (pct < 0.6)  return "var(--warn)";
  return "var(--alarm)";
}

type Props = { data: DataPoint[] };

export function TimelineRibbon({ data }: Props) {
  const max    = 180;
  const points = data.slice(-max);
  const callPct = (CALL_LEVEL / GAUGE_MAX) * 100;

  if (points.length === 0) {
    return (
      <div
        className="rounded-xl border px-4 py-3 flex items-center"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        <span className="text-[10px] font-semibold tracking-widest text-[var(--muted)]">
          24H TIMELINE — waiting for data…
        </span>
      </div>
    );
  }

  const first = points[0].t;
  const last  = points[points.length - 1].t;

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--border)", background: "var(--panel)" }}
    >
      {/* header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold tracking-widest text-[var(--muted)]">
          SURPRISAL TIMELINE
        </span>
        <span className="text-[10px] font-mono text-[var(--muted)]">
          {first} → {last}
        </span>
      </div>

      {/* heat strip with threshold line */}
      <div className="relative">
        {/* faint horizontal line at CALL level */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            bottom: `${callPct}%`,
            borderTop: "1px dashed var(--warn)",
            opacity: 0.4,
          }}
        />

        <div className="flex gap-px h-6 items-end w-full overflow-hidden rounded-md">
          {points.map((pt, i) => {
            const h   = Math.max(2, (pt.a / GAUGE_MAX) * 100);
            const col = anomalyColor(pt.a);
            return (
              <motion.div
                key={i}
                className="flex-1 rounded-sm"
                style={{ background: col, opacity: 0.75 + 0.25 * (pt.a / GAUGE_MAX) }}
                animate={{ height: `${h}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            );
          })}
        </div>
      </div>

      {/* footer: legend + now-marker */}
      <div className="flex items-center justify-between mt-1.5">
        {/* legend */}
        <div className="flex items-center gap-3">
          {[
            { color: "var(--calm)",  label: "calm"  },
            { color: "var(--warn)",  label: "watch" },
            { color: "var(--alarm)", label: "alert" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: color, opacity: 0.8 }} />
              <span className="text-[9px] font-mono text-[var(--muted)]">{label}</span>
            </div>
          ))}
          <span className="text-[9px] font-mono text-[var(--muted)]">
            — call threshold
          </span>
        </div>

        {/* now-marker */}
        <motion.span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: "var(--alarm)", color: "#0A0A0B" }}
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          NOW {last}
        </motion.span>
      </div>
    </div>
  );
}
