"use client";
import { useEffect, useState } from "react";

type Pt = { t: number; rms: number; state: "moving" | "carried" | "at_rest" };
type Carry = { trace: Pt[]; marks: number[]; rest_floor: number; move_thresh: number };

const W = 320, H = 54, CAP = 0.6;  // clamp rms; spikes hit the ceiling = the tap

export function CarryPanel() {
  const [c, setC] = useState<Carry | null>(null);
  useEffect(() => { fetch("/iphone_carry.json").then(r => r.json()).then(setC).catch(() => {}); }, []);
  if (!c || !c.trace.length) return null;

  const t0 = c.trace[0].t, t1 = c.trace[c.trace.length - 1].t, span = t1 - t0 || 1;
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (rms: number) => H - (Math.min(rms, CAP) / CAP) * H;
  const line = c.trace.map(p => `${x(p.t).toFixed(1)},${y(p.rms).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
          Carry signal · is the phone on her?
        </h3>
        <span className="text-[9px] font-mono text-[var(--muted)]">accelerometer</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
        {/* rest-floor guide */}
        <line x1="0" x2={W} y1={y(c.rest_floor)} y2={y(c.rest_floor)}
              stroke="var(--border)" strokeDasharray="2 3" strokeWidth="1" />
        {/* set-down / pick-up marks */}
        {c.marks.map((m, i) => (
          <line key={i} x1={x(m)} x2={x(m)} y1="0" y2={H}
                stroke="var(--accent)" strokeDasharray="2 2" strokeWidth="1" opacity="0.7" />
        ))}
        <polyline points={line} fill="none" stroke="var(--text)" strokeWidth="1.5" />
      </svg>

      <div className="flex justify-between mt-1 text-[9px] font-mono text-[var(--muted)]">
        <span>carried (on body)</span>
        <span style={{ color: "var(--accent)" }}>↑ set down · picked up ↑</span>
        <span>at rest (table)</span>
      </div>
      <p className="text-[10px] font-mono text-[var(--muted)] mt-2 leading-relaxed">
        It knows when the phone is carried vs set down — “she stopped carrying her phone” is
        itself a signal.
      </p>
    </div>
  );
}
