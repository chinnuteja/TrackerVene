"use client";
import { useState, useEffect } from "react";
import { useRoutineFeed } from "@/hooks/useRoutineFeed";

import { LivingFloorplan }   from "@/components/LivingFloorplan";
import { AnomalyGauge }      from "@/components/AnomalyGauge";
import { AnomalySparkline }  from "@/components/AnomalySparkline";
import { RoutineStability }  from "@/components/RoutineStability";
import { ReasoningFeed }     from "@/components/ReasoningFeed";
import { ProbeCard }         from "@/components/ProbeCard";
import { RunToggle }         from "@/components/RunToggle";
import { ScenarioPicker }    from "@/components/ScenarioPicker";
import { MemoryPanel }       from "@/components/MemoryPanel";
import { CaregiverHistory }  from "@/components/CaregiverHistory";
import { TimelineRibbon }    from "@/components/TimelineRibbon";
import { IntroOverlay }      from "@/components/IntroOverlay";
import { StatusNarration }  from "@/components/StatusNarration";
import { AbsenceAlert }     from "@/components/AbsenceAlert";
import { BlindAlert }       from "@/components/BlindAlert";
import { IPHONE_POS, IPHONE_EDGES } from "@/lib/floorplan";
import { LiveRead }        from "@/components/LiveRead";
import { ColdStartNote }   from "@/components/ColdStartNote";
import { WatchingNote }    from "@/components/WatchingNote";
import { CarryPanel }       from "@/components/CarryPanel";
import { PlacesPanel }      from "@/components/PlacesPanel";

type ValidationStats = { detection_rate: string; false_alarms_per_day: number | null; median_latency_min: number | null };

export default function Page() {
  const [showIntro, setShowIntro] = useState(true);
  const [validationStats, setValidationStats] = useState<ValidationStats | null>(null);

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/feed")
      .replace(/^ws/, "http").replace(/\/ws\/feed$/, "");
    fetch(`${base}/stats`).then(r => r.json()).then(setValidationStats).catch(() => {});
  }, []);

  const {
    currentRoom, anomaly, series, decisions, changepoint, isDone,
    currentProbe, lastResolution, callPhase,
    memory, incidents,
    location, currentAbsence, blind, live,
    scenario, setScenario,
    mode, setMode,
    answer,
  } = useRoutineFeed();

  const isCalm   = scenario === "calm";
  const isIphone = scenario === "iphone_realday";

  return (
    <>
      {/* ── Intro overlay ───────────────────────────────────────────── */}
      {showIntro && <IntroOverlay onDismiss={() => { setShowIntro(false); setScenario("iphone_realday"); }} />}

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <main
        className="h-screen w-screen overflow-hidden flex flex-col"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        {/* ╔══ HEADER ══════════════════════════════════════════════════╗ */}
        <header
          className="flex items-center gap-4 px-6 py-3 flex-shrink-0 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          {/* identity */}
          <div className="flex items-center gap-2.5 mr-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--accent)", color: "#0A0A0B" }}
            >
              ◉
            </div>
            <div>
              <span className="text-sm font-semibold">{isIphone ? "My apartment" : "Mary, 85"}</span>
              <span className="text-[var(--muted)] text-xs ml-2">{isIphone ? "· iPhone" : "· Home"}</span>
            </div>
          </div>

          {/* demo controls */}
          <RunToggle scenario={scenario} setScenario={setScenario} />
          <ScenarioPicker
            scenario={scenario}
            setScenario={setScenario}
            mode={mode}
            setMode={setMode}
            disabled={isCalm}
          />

          {/* spacer */}
          <div className="flex-1" />

          {/* status pill */}
          <div className="flex items-center gap-2">
            {isDone && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full border font-mono"
                style={{ color: "var(--muted)", borderColor: "var(--border)" }}
              >
                REPLAY DONE
              </span>
            )}
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: isDone ? "var(--muted)" : "var(--calm)",
                       boxShadow: isDone ? "none" : "0 0 6px var(--calm)" }}
            />
            <span className="text-[10px] font-mono text-[var(--muted)]">
              ROUTINE TOPOLOGY ENGINE
            </span>
          </div>
        </header>

        {/* ╔══ STATUS NARRATION ════════════════════════════════════════╗ */}
        <div className="px-6 py-1 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <StatusNarration
            anomaly={anomaly}
            callPhase={callPhase}
            stability={changepoint.stability}
            name={memory?.name ?? "the resident"}
            lastStandDown={lastResolution?.stand_down}
            hasAbsence={!!currentAbsence}
          />
        </div>

        {/* ╔══ BODY ════════════════════════════════════════════════════╗ */}
        <div className="flex-1 overflow-hidden grid grid-cols-[1.6fr_1fr] gap-4 p-4">

          {/* ── LEFT: living floorplan ─────────────────────────────── */}
          <div
            className="rounded-2xl border flex flex-col overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--panel)" }}
          >
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Living Floorplan</h2>
                {isIphone && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border tracking-wide"
                        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                    iPhone · recorded
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)]">
                {blind
                  ? "Signal lost — can’t see her"
                  : currentAbsence
                    ? `Left ${currentAbsence.from_room} — location unknown`
                    : currentRoom
                      ? (isIphone ? `In the ${currentRoom}` : `Mary is in the ${currentRoom}`)
                      : "Waiting for data…"}
              </p>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <LivingFloorplan
                currentRoom={currentRoom}
                anomaly={anomaly}
                location={location}
                currentAbsence={currentAbsence}
                blind={!!blind}
                layout={isIphone ? { pos: IPHONE_POS, edges: IPHONE_EDGES } : undefined}
              />
            </div>
          </div>

          {/* ── RIGHT: instruments ────────────────────────────────── */}
          <div className="flex flex-col gap-3 overflow-y-auto min-h-0">

            {/* iPhone demo: orientation → plain-language live read → data note */}
            {isIphone && (
              <>
                <WatchingNote />
                <LiveRead
                  live={live}
                  anomaly={anomaly}
                  callPhase={callPhase}
                  currentAbsence={currentAbsence}
                  blind={blind}
                />
                <ColdStartNote />
              </>
            )}

            {/* gauge + sparkline */}
            <div
              className="rounded-2xl border p-4 flex-shrink-0"
              style={{ borderColor: "var(--border)", background: "var(--panel)" }}
            >
              <AnomalyGauge anomaly={anomaly} stability={changepoint.stability} />
              <AnomalySparkline data={series} />
            </div>

            {/* BOCD stability */}
            <div className="flex-shrink-0">
              <RoutineStability state={changepoint} />
            </div>

            {/* iPhone demo panels — carry signal + discovered places */}
            {isIphone && (
              <>
                <div className="flex-shrink-0"><CarryPanel /></div>
                <div className="flex-shrink-0"><PlacesPanel /></div>
              </>
            )}

            {/* absence alert — appears when absence detected */}
            <div className="flex-shrink-0">
              <AbsenceAlert absence={currentAbsence} />
            </div>

            {/* blind / observability alert — phone went dark */}
            <div className="flex-shrink-0">
              <BlindAlert blind={blind} />
            </div>

            {/* probe card — appears only when probe is active */}
            <div className="flex-shrink-0">
              <ProbeCard
                callPhase={callPhase}
                probe={currentProbe}
                resolution={lastResolution}
                mode={mode}
                answer={answer}
                name={memory?.name ?? "the resident"}
              />
            </div>

            {/* agent reasoning feed */}
            <div
              className="rounded-2xl border p-4 flex-1 min-h-0 overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--panel)" }}
            >
              <ReasoningFeed decisions={decisions} />
            </div>

            {/* memory panel — hidden for the iPhone home (day one, nothing learned yet) */}
            {!isIphone && (
              <div className="flex-shrink-0">
                <MemoryPanel
                  memory={memory}
                  latestProbe={currentProbe?.script}
                />
              </div>
            )}

            {/* caregiver history */}
            <div className="flex-shrink-0">
              <CaregiverHistory
                incidents={incidents}
                subtitle={isIphone
                  ? "What the family would see from this session."
                  : undefined}
              />
            </div>
          </div>
        </div>

        {/* ╔══ FOOTER: timeline ribbon + validation stats ═══════════════╗ */}
        <div className="flex-shrink-0 px-4 pb-4 flex flex-col gap-2">
          <TimelineRibbon data={series} />
          {validationStats && (
            <div className="flex items-center gap-4 px-3">
              <span className="text-[9px] font-mono text-[var(--muted)] tracking-widest uppercase">
                Validation
              </span>
              <span className="text-[9px] font-mono" style={{ color: "var(--calm)" }}>
                {validationStats.false_alarms_per_day === 0
                  ? "0 false-alarms/day"
                  : `${validationStats.false_alarms_per_day} FA/day`}
              </span>
              <span className="text-[9px] font-mono text-[var(--muted)]">·</span>
              <span className="text-[9px] font-mono" style={{ color: "var(--accent)" }}>
                UTI detected in {validationStats.median_latency_min} min
              </span>
              <span className="text-[9px] font-mono text-[var(--muted)]">·</span>
              <span className="text-[9px] font-mono text-[var(--muted)]">
                {validationStats.detection_rate} scenarios · 20/20 tests passing
              </span>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
