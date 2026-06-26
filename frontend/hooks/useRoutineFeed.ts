"use client";
import useWebSocket from "react-use-websocket";
import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type Scenario = "calm" | "uti" | "wandering" | "depressive" | "hallway_fall"
                     | "uti_multiday" | "wandering_multiday" | "depressive_multiday";
export type Mode      = "auto" | "interactive";
export type CallPhase = "idle" | "composing" | "ringing" | "calling" | "listening" | "interpreting" | "resolved";

export type Decision = {
  action:       "observe" | "ambient_nudge" | "soft_checkin" | "escalate_caregiver";
  anomaly:      number;
  trigger:      string;
  explanation:  string;
  stability:    "stable" | "possible_drift" | "regime_shift";
  change_prob:  number;
  is_probe:     boolean;
  is_escalation:boolean;
  script?:      string;
  script_source?:"llm" | "fallback";
};

export type ChangepointState = {
  change_prob: number;
  run_length:  number;
  stability:   "stable" | "possible_drift" | "regime_shift";
  confidence:  number;
};

export type Probe = {
  script: string;
  reason: string;
  source: "llm" | "fallback";
};

export type Resolution = {
  verdict:    "reassuring" | "worrying" | "no_answer";
  rationale:  string;
  transcript: string;
  delta:      number;
  stand_down: boolean;
  anomaly:    number;
};

export type MemoryState = {
  name?:     string;
  brief:     string;
  incidents: Incident[];
};

export type Incident = {
  ts:         string;
  kind:       string;
  summary:    string;
  action:     string;
  resolution: string;
};

export type LocationState = {
  best:       string;
  confidence: number;
  belief:     Record<string, number>;
};

export type AbsenceEvent = {
  from_room:       string;
  last_seen_ts:    string;
  silent_for:      number;
  expected_within: number;
  within_room:     boolean;
  severity:        "high";
};

export type FeedMsg = {
  type:        string;
  event?:      { room: string; ts: string; value: string };
  score?:      { surprisal: number; anomaly: number; reason: string };
  decision?:   Decision;
  changepoint?:ChangepointState;
  rooms?:      string[];
  probe?:      never;         // handled via type === "probe"
  resolution?: never;
} & Record<string, unknown>;

// ── Hook ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/feed";

function buildUrl(scenario: Scenario, mode: Mode) {
  return `${BASE_URL}?scenario=${scenario}&mode=${mode}`;
}

export function useRoutineFeed() {
  const [scenario, setScenarioState] = useState<Scenario>("calm");
  const [mode,     setModeState]     = useState<Mode>("auto");

  // Force re-mount of the WS by changing the url key
  const url = buildUrl(scenario, mode);

  const { lastJsonMessage, sendJsonMessage, readyState } =
    useWebSocket(url, {
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: 1500,
    });

  // ── feed state ─────────────────────────────────────────────────────────
  const [currentRoom,    setCurrentRoom]    = useState<string | null>(null);
  const [anomaly,        setAnomaly]        = useState(0);
  const [series,         setSeries]         = useState<{ t: string; a: number }[]>([]);
  const [decisions,      setDecisions]      = useState<Decision[]>([]);
  const [rooms,          setRooms]          = useState<string[]>([]);
  const [changepoint,    setChangepoint]    = useState<ChangepointState>({
    change_prob: 0, run_length: 0, stability: "stable", confidence: 1,
  });
  const [currentProbe,   setCurrentProbe]   = useState<Probe | null>(null);
  const [lastResolution, setLastResolution] = useState<Resolution | null>(null);
  const [memory,         setMemory]         = useState<MemoryState | null>(null);
  const [incidents,      setIncidents]      = useState<Incident[]>([]);
  const [isDone,         setIsDone]         = useState(false);
  const [callPhase,      setCallPhase]      = useState<CallPhase>("idle");
  const [location,       setLocation]       = useState<LocationState | null>(null);
  const [currentAbsence, setCurrentAbsence] = useState<AbsenceEvent | null>(null);

  // reset all feed state when scenario/mode changes
  const resetFeed = useCallback(() => {
    setCurrentRoom(null);
    setAnomaly(0);
    setSeries([]);
    setDecisions([]);
    setCurrentProbe(null);
    setLastResolution(null);
    setCallPhase("idle");
    setIsDone(false);
    setLocation(null);
    setCurrentAbsence(null);
    // keep memory + incidents — they're persistent across runs
  }, []);

  const prevUrl = useRef(url);
  useEffect(() => {
    if (prevUrl.current !== url) {
      prevUrl.current = url;
      resetFeed();
    }
  }, [url, resetFeed]);

  // ── inbound message handler ────────────────────────────────────────────
  useEffect(() => {
    const m = lastJsonMessage as Record<string, unknown> | null;
    if (!m) return;

    switch (m.type) {
      case "meta":
        if (Array.isArray(m.rooms)) setRooms(m.rooms as string[]);
        break;

      case "event": {
        const ev  = m.event  as { room: string; ts: string; value: string } | undefined;
        const sc  = m.score  as { surprisal: number; anomaly: number; reason: string } | undefined;
        const cp  = m.changepoint as ChangepointState | undefined;
        const dec = m.decision as Decision | undefined;
        const loc = m.location as LocationState | undefined;
        if (ev && sc) {
          setCurrentRoom(ev.room);
          setAnomaly(sc.anomaly);
          setSeries(s => [
            ...s.slice(-180),
            { t: ev.ts.slice(11, 16), a: sc.anomaly },
          ]);
        }
        if (cp) setChangepoint(cp);
        if (dec && dec.action !== "observe") {
          setDecisions(d => [dec, ...d].slice(0, 8));
        }
        if (loc) setLocation(loc);
        // clear absence once a new event arrives
        setCurrentAbsence(null);
        break;
      }

      case "absence":
        setCurrentAbsence(m as unknown as AbsenceEvent);
        break;

      case "call":
        setCallPhase(m.phase as CallPhase);
        break;

      case "probe":
        setCurrentProbe({
          script: m.script as string,
          reason: m.reason as string,
          source: (m.source as "llm" | "fallback") ?? "fallback",
        });
        setCallPhase("calling");
        setLastResolution(null);
        break;

      case "resolution":
        setLastResolution(m as unknown as Resolution);
        setCallPhase("resolved");
        break;

      case "memory":
        setMemory({
          name:      (m.name      as string) ?? undefined,
          brief:     (m.brief     as string) ?? "",
          incidents: (m.incidents as Incident[]) ?? [],
        });
        break;

      case "incident":
        setIncidents(prev => {
          const inc = m.incident as Incident;
          if (prev.some(i => i.ts === inc.ts)) return prev;
          return [inc, ...prev].slice(0, 20);
        });
        break;

      case "done":
        setIsDone(true);
        break;
    }
  }, [lastJsonMessage]);

  // ── outbound ──────────────────────────────────────────────────────────
  const answer = useCallback((text: string) => {
    sendJsonMessage({ type: "answer", text });
    // optimistically clear the probe card
    setCurrentProbe(null);
  }, [sendJsonMessage]);

  const setScenario = useCallback((s: Scenario) => {
    setScenarioState(s);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
  }, []);

  return {
    // feed
    currentRoom, anomaly, series, decisions, rooms, changepoint,
    isDone, readyState,
    // conversation
    currentProbe, lastResolution, callPhase,
    // memory
    memory, incidents,
    // location + absence
    location, currentAbsence,
    // control
    scenario, setScenario, mode, setMode,
    answer,
  };
}
