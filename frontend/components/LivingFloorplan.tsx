import { motion } from "framer-motion";
import { ROOM_POS, EDGES } from "@/lib/floorplan";
import type { LocationState, AbsenceEvent } from "@/hooks/useRoutineFeed";

type Props = {
  currentRoom:     string | null;
  anomaly:         number | undefined;
  location?:       LocationState | null;
  currentAbsence?: AbsenceEvent | null;
};

export function LivingFloorplan({ currentRoom, anomaly, location, currentAbsence }: Props) {
  const heat       = Math.min((anomaly ?? 0) / 14, 1);
  const pulseColor = `hsl(${(1 - heat) * 150}, 80%, 55%)`;

  const inTransit   = !!currentAbsence;
  const fromRoom    = currentAbsence?.from_room ?? null;
  const displayRoom = inTransit ? fromRoom : currentRoom;
  const pos         = (displayRoom && ROOM_POS[displayRoom]) ? ROOM_POS[displayRoom] : { x: 200, y: 200 };

  const confidence  = location?.confidence ?? 1;
  const showBelief  = !inTransit && confidence < 0.8 && location != null;

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
      {Object.entries(ROOM_POS).map(([room, p]) => {
        const isFrom   = inTransit && room === fromRoom;
        const beliefVal = showBelief ? (location?.belief?.[room] ?? 0) : 0;
        return (
          <g key={room}>
            <circle cx={p.x} cy={p.y} r={18}
              fill="var(--panel)"
              stroke={isFrom ? "var(--alarm)" : "var(--border)"}
              strokeWidth={isFrom ? 2 : 1}
              opacity={inTransit && !isFrom ? 0.4 : 1}
            />
            {beliefVal > 0.05 && (
              <circle cx={p.x} cy={p.y} r={18}
                fill={pulseColor} opacity={beliefVal * 0.4} />
            )}
            <text x={p.x} y={p.y + 32} textAnchor="middle"
              fontSize={9} fill="var(--muted)"
              opacity={inTransit && !isFrom ? 0.4 : 1}
            >{room}</text>
          </g>
        );
      })}

      {/* normal pulse + breathing halo */}
      {!inTransit && (
        <>
          <motion.circle
            r={13}
            animate={{ cx: pos.x, cy: pos.y }}
            transition={{ type: "spring", stiffness: 80, damping: 14 }}
            fill={pulseColor}
            style={{ filter: `drop-shadow(0 0 12px ${pulseColor})` }}
          />
          <motion.circle
            cx={pos.x} cy={pos.y} fill="none"
            stroke={pulseColor} strokeOpacity={0.4}
            animate={{ r: [13, 22 + heat * 14, 13] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* in-transit: ghost + dashed pulsing ring + "?" */}
      {inTransit && (
        <>
          <circle cx={pos.x} cy={pos.y} r={13}
            fill={pulseColor} opacity={0.25} />
          <motion.circle
            cx={pos.x} cy={pos.y} r={22} fill="none"
            stroke="var(--alarm)" strokeWidth={1.5} strokeDasharray="4 4"
            animate={{ r: [20, 30, 20], opacity: [0.8, 0.2, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <text x={pos.x} y={pos.y + 5} textAnchor="middle"
            dominantBaseline="middle" fontSize={14}
            fontFamily="monospace" fontWeight="bold"
            fill="var(--alarm)" opacity={0.9}
          >?</text>
          <text x={pos.x} y={pos.y + 46} textAnchor="middle"
            fontSize={8} fill="var(--alarm)" opacity={0.8}
          >in transit / unknown</text>
        </>
      )}

      {/* low-confidence caption */}
      {showBelief && location && (
        <text x={200} y={390} textAnchor="middle"
          fontSize={8} fill="var(--muted)"
        >
          best guess: {location.best} · {Math.round(confidence * 100)}%
        </text>
      )}
    </svg>
  );
}
