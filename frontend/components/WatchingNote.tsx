"use client";

// First-time-viewer orientation for the iPhone tab: makes it unmistakable that this is a
// sped-up replay of a short real recording, with two staged beats — so no one wonders
// "wait, what am I actually looking at?"
export function WatchingNote() {
  const steps = [
    "Real iPhone movement plays as a normal routine.",
    "A staged silence shows how the system checks in.",
    "A staged phone-off shows why “visibility lost” isn’t all-clear.",
  ];
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 7%, var(--panel))" }}
    >
      <div className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--accent)" }}>
        What you’re watching
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--text)] mb-2">
        A <span className="font-semibold">compressed replay</span> of ~11 minutes of real iPhone
        movement, sped up so the whole flow is visible — <span className="text-[var(--muted)]">not live monitoring.</span>
      </p>
      <ol className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-[11px] leading-snug text-[var(--muted)]">
            <span className="font-mono flex-shrink-0" style={{ color: "var(--accent)" }}>{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
