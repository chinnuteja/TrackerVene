import { motion } from "framer-motion";

const GAUGE_MAX = 14;
const THRESHOLDS = [
  { value: 4,  label: "W", title: "WATCH" },
  { value: 8,  label: "C", title: "CALL"  },
  { value: 14, label: "E", title: "ESC"   },
];

function angleDeg(value: number) {
  // arc goes from -135° to +135° (270° sweep), mapping 0–14
  return -135 + (value / GAUGE_MAX) * 270;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function ThresholdTick({
  value, label, cx, cy, R, dimmed,
}: { value: number; label: string; cx: number; cy: number; R: number; dimmed?: boolean }) {
  const deg = angleDeg(value);
  const inner = polarToXY(cx, cy, R - 7, deg);
  const outer = polarToXY(cx, cy, R + 3, deg);
  const textPt = polarToXY(cx, cy, R - 18, deg);
  const color = value <= 4 ? "var(--calm)" : value <= 8 ? "var(--warn)" : "var(--alarm)";

  return (
    <g>
      <line
        x1={inner.x} y1={inner.y}
        x2={outer.x} y2={outer.y}
        stroke={color} strokeWidth={dimmed ? 1 : 1.5} opacity={dimmed ? 0.25 : 0.7}
      />
      <text
        x={textPt.x} y={textPt.y}
        textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={7} fontFamily="monospace" opacity={dimmed ? 0.3 : 0.8}
      >
        {label}
      </text>
    </g>
  );
}

export function AnomalyGauge({
  anomaly,
  stability,
}: {
  anomaly: number | undefined;
  stability?: "stable" | "possible_drift" | "regime_shift";
}) {
  const safeAnomaly = anomaly ?? 0;
  const pct   = Math.min(safeAnomaly / GAUGE_MAX, 1);

  // When a regime shift is detected the backend lowers every threshold by 40%
  // (DRIFT_THRESHOLD_REDUCTION = 0.6). The gauge must reflect that, otherwise a
  // legitimate call at a low anomaly looks like a bug ("within normal range" + green
  // while ON A CALL). Scale the effective thresholds the same way.
  const shifted = stability === "regime_shift";
  const factor  = shifted ? 0.6 : 1;
  const tWatch  = 4  * factor;
  const tCall   = 8  * factor;
  const tEsc    = 14 * factor;

  const color =
    safeAnomaly < tWatch ? "var(--calm)" :
    safeAnomaly < tCall  ? "var(--warn)" :
                           "var(--alarm)";

  const caption =
    safeAnomaly < tWatch ? "within normal range" :
    safeAnomaly < tCall  ? (shifted ? "watching · bar lowered" : "watching") :
    safeAnomaly < tEsc   ? "on a call" :
                           "escalation";

  // Ticks slide inward when thresholds drop, so the lowered bar is visible.
  const activeThresholds = [
    { value: tWatch, label: "W" },
    { value: tCall,  label: "C" },
    { value: tEsc,   label: "E" },
  ];

  // arc params: 270° sweep starting at -135° (bottom-left to bottom-right)
  const R   = 70;
  const cx  = 90;
  const cy  = 90;
  const C   = 2 * Math.PI * R;               // full circumference
  const arc = (270 / 360) * C;               // 270° arc length
  const gap = C - arc;                        // unused 90° gap

  return (
    <div className="relative flex items-center justify-center">
      <svg width={180} height={180}>
        {/* track arc */}
        <circle cx={cx} cy={cy} r={R} fill="none"
          stroke="var(--border)" strokeWidth={10}
          strokeDasharray={`${arc} ${gap}`}
          strokeDashoffset={-gap / 2 - arc}   /* offset so gap is at bottom */
          transform={`rotate(135 ${cx} ${cy})`}
        />

        {/* value arc */}
        <motion.circle cx={cx} cy={cy} r={R} fill="none"
          stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${arc} ${gap}`}
          transform={`rotate(135 ${cx} ${cy})`}
          animate={{ strokeDashoffset: arc * (1 - pct) - arc - gap / 2 }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />

        {/* threshold ticks — slide inward on regime shift */}
        {shifted && THRESHOLDS.map(t => (
          <ThresholdTick key={`base-${t.value}`} value={t.value} label="" cx={cx} cy={cy} R={R} dimmed />
        ))}
        {activeThresholds.map(t => (
          <ThresholdTick key={t.value} value={t.value} label={t.label} cx={cx} cy={cy} R={R} />
        ))}
      </svg>

      {/* centre label */}
      <div className="absolute text-center">
        <div className="text-4xl font-mono" style={{ color }}>
          {safeAnomaly.toFixed(1)}
        </div>
        <div className="text-[10px] text-[var(--muted)] tracking-wide font-mono">ANOMALY</div>
        <div className="text-[9px] font-mono mt-0.5" style={{ color }}>
          {caption}
        </div>
        {shifted && (
          <div className="text-[8px] font-mono mt-0.5" style={{ color: "var(--alarm)" }}>
            ▼ regime shift · thresholds −40%
          </div>
        )}
      </div>
    </div>
  );
}
