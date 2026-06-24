import { motion } from "framer-motion";
import { ROOM_POS, EDGES } from "@/lib/floorplan";

export function LivingFloorplan({ currentRoom, anomaly }:
  { currentRoom: string | null; anomaly: number | undefined }) {
  const pos = currentRoom ? ROOM_POS[currentRoom] : { x: 200, y: 200 };
  const heat = Math.min((anomaly ?? 0) / 14, 1); // 0..1 -> green..red
  const pulseColor = `hsl(${(1 - heat) * 150}, 80%, 55%)`;

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      {/* edges */}
      {EDGES.map(([a, b], i) => {
        if (!ROOM_POS[a] || !ROOM_POS[b]) return null;
        return (
          <line key={i}
            x1={ROOM_POS[a].x} y1={ROOM_POS[a].y}
            x2={ROOM_POS[b].x} y2={ROOM_POS[b].y}
            stroke="var(--border)" strokeWidth={1.5} />
        );
      })}
      {/* room nodes */}
      {Object.entries(ROOM_POS).map(([room, p]) => (
        <g key={room}>
          <circle cx={p.x} cy={p.y} r={18}
            fill="var(--panel)" stroke="var(--border)" />
          <text x={p.x} y={p.y + 32} textAnchor="middle"
            fontSize={9} fill="var(--muted)">{room}</text>
        </g>
      ))}
      {/* the living pulse */}
      <motion.circle
        r={13}
        animate={{ cx: pos.x, cy: pos.y }}
        transition={{ type: "spring", stiffness: 80, damping: 14 }}
        fill={pulseColor}
        style={{ filter: `drop-shadow(0 0 12px ${pulseColor})` }}
      />
      {/* breathing halo scales with anomaly */}
      <motion.circle
        cx={pos.x} cy={pos.y} fill="none"
        stroke={pulseColor} strokeOpacity={0.4}
        animate={{ r: [13, 22 + heat * 14, 13] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}
