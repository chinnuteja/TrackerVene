"use client";

// Honest framing for the watcher: this is thin, day-one data — say so, and say what more unlocks.
export function ColdStartNote() {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "transparent" }}>
      <p className="text-[10px] font-mono leading-relaxed text-[var(--muted)]">
        <span style={{ color: "var(--accent)" }}>Day one · ~11 min of data,</span>{" "}
        so “normal” here is rough. With continuous data it learns her true routine and can flag
        gradual change — declining mobility, a developing UTI; the multi-day scenarios show that on
        real research data.
      </p>
    </div>
  );
}
