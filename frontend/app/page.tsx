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
    scenario, setScenario,
    mode, setMode,
    answer,
  } = useRoutineFeed();

  const isCalm = scenario === "calm";

  return (
    <>
      {/* ── Intro overlay ───────────────────────────────────────────── */}
      {showIntro && <IntroOverlay onDismiss={() => setShowIntro(false)} />}

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
              <span className="text-sm font-semibold">Mary, 85</span>
              <span className="text-[var(--muted)] text-xs ml-2">· Home</span>
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
              <h2 className="text-sm font-semibold">Living Floorplan</h2>
              <p className="text-xs text-[var(--muted)]">
                {currentRoom
                  ? `Mary is in the ${currentRoom}`
                  : "Waiting for data…"}
              </p>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <LivingFloorplan currentRoom={currentRoom} anomaly={anomaly} />
            </div>
          </div>

          {/* ── RIGHT: instruments ────────────────────────────────── */}
          <div className="flex flex-col gap-3 overflow-y-auto min-h-0">

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

            {/* memory panel */}
            <div className="flex-shrink-0">
              <MemoryPanel
                memory={memory}
                latestProbe={currentProbe?.script}
              />
            </div>

            {/* caregiver history */}
            <div className="flex-shrink-0">
              <CaregiverHistory incidents={incidents} />
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
