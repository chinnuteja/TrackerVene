"use client";
import { useEffect, useState } from "react";

type Places = { n_places: number; assign: number[]; cluster_room: Record<string, string> };

export function PlacesPanel() {
  const [p, setP] = useState<Places | null>(null);
  useEffect(() => { fetch("/iphone_places.json").then(r => r.json()).then(setP).catch(() => {}); }, []);
  if (!p) return null;

  const clusters = Object.entries(p.cluster_room); // [clusterId, room]

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
          Places · discovered from the data
        </h3>
        <span className="text-[10px] font-mono" style={{ color: "var(--accent)" }}>
          {p.n_places} found
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {clusters.map(([id, room]) => (
          <span key={id} className="px-2 py-0.5 rounded-md border text-[10px] font-mono"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}>
            {room}
          </span>
        ))}
      </div>

      <p className="text-[10px] font-mono text-[var(--muted)] mt-2 leading-relaxed">
        The system grouped the dwells into places on its own (labels confirmed from the walk).
        Rough on 11 min in a small flat — it sharpens with fingerprinting over days.
      </p>
    </div>
  );
}
