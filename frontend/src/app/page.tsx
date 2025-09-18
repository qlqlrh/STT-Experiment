"use client";
import React, { useMemo, useState } from "react";
import ParamsPanel from "@/components/dashboard/ParamsPanel";
import HeaderKpiBar from "@/components/dashboard/HeaderKpiBar";
import Tabs from "@/components/dashboard/Tabs";
import LivePane from "@/components/dashboard/LivePane";
import SummaryPane from "@/components/dashboard/SummaryPane";
import DistributionsPane from "@/components/dashboard/DistributionsPane";
import RunsPane from "@/components/dashboard/RunsPane";
import LogsPane from "@/components/dashboard/LogsPane";
import { Metrics, Run, Scenario, Segment } from "@/types/experiment";
import { mean, p95, std } from "@/utils/stats";
import { runExperiment } from "@/lib/experiment";

export default function Home() {
  const [activeTab, setActiveTab] = useState("Live");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [current, setCurrent] = useState<Segment | null>(null);
  const [recent, setRecent] = useState<Segment[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<"all"|"failed"|"dropped">("all");

  const metrics = useMemo<Metrics>(() => {
    const e2eArr = recent.map((s) => s.e2e);
    const sttArr = recent.map((s) => s.stt);
    const txArr = recent.map((s) => s.tx);
    const uiArr = recent.map((s) => s.ui);
    return {
      n: recent.length,
      e2e: { mean: mean(e2eArr), p95: p95(e2eArr), std: std(e2eArr) },
      stt: { mean: mean(sttArr), p95: p95(sttArr) },
      tx: { mean: mean(txArr), p95: p95(txArr) },
      ui: { mean: mean(uiArr), p95: p95(uiArr) },
    };
  }, [recent]);

  const kpiText = useMemo(() => {
    if (metrics.n === 0) return "—";
    const ok = metrics.e2e.mean <= 1500 && metrics.e2e.p95 <= 2500;
    return ok ? "KPI PASS" : metrics.e2e.p95 <= 3000 ? "KPI WARN" : "KPI FAIL";
  }, [metrics]);
  const kpiStatus: "pass"|"warn"|"fail" = kpiText.includes("PASS") ? "pass" : kpiText.includes("WARN") ? "warn" : "fail";

  function onStart(s: Scenario, file: File) {
    setScenario(s);
    setActiveTab("Live");
    setCurrent(null);
    setRecent([]);

    const segmentId = "seg-" + Math.random().toString(36).slice(2, 8);
    runExperiment(
      {
        segmentId,
        frame: s.frame,
        threads: s.threads,
        buffer: s.buffer,
        capacity: s.capacity,
        win: s.win,
        hop: s.hop,
        lang: s.lang,
        pace: s.pace,
      },
      file,
      {
        onSegmentUpdate: (seg) => {
          setCurrent((prev) => ({
            id: segmentId,
            t1: seg.t1 ?? prev?.t1 ?? 0,
            t2: seg.t2 ?? prev?.t2 ?? 0,
            t3: seg.t3 ?? prev?.t3 ?? 0,
            t4: seg.t4 ?? prev?.t4 ?? 0,
            t5: seg.t5 ?? prev?.t5 ?? 0,
            e2e: seg.e2e ?? prev?.e2e ?? 0,
            stt: seg.stt ?? prev?.stt ?? 0,
            tx: seg.tx ?? prev?.tx ?? 0,
            ui: seg.ui ?? prev?.ui ?? 0,
            transcript: seg.transcript ?? prev?.transcript,
            t1Epoch: seg.t1Epoch ?? prev?.t1Epoch,
            t2Epoch: seg.t2Epoch ?? prev?.t2Epoch,
            t3Epoch: seg.t3Epoch ?? prev?.t3Epoch,
            t4Epoch: seg.t4Epoch ?? prev?.t4Epoch,
            t5Epoch: seg.t5Epoch ?? prev?.t5Epoch,
          }));
          if (seg.e2e !== undefined) {
            setRecent((r) => [
              {
                ...(current ?? ({} as any)),
                id: segmentId,
                e2e: seg.e2e!,
                stt: seg.stt ?? 0,
                tx: seg.tx ?? 0,
                ui: seg.ui ?? 0,
                t1: seg.t1!,
                t2: seg.t2 ?? seg.t1!,
                t3: seg.t3 ?? seg.t2 ?? seg.t1!,
                t4: seg.t4 ?? seg.t3 ?? seg.t2 ?? seg.t1!,
                t5: seg.t5!,
                t1Epoch: seg.t1Epoch ?? (current as any)?.t1Epoch,
                t2Epoch: seg.t2Epoch ?? (current as any)?.t2Epoch,
                t3Epoch: seg.t3Epoch ?? (current as any)?.t3Epoch,
                t4Epoch: seg.t4Epoch ?? (current as any)?.t4Epoch,
                t5Epoch: seg.t5Epoch ?? (current as any)?.t5Epoch,
              },
              ...r,
            ].slice(0, 200));
          }
        },
        onCompleted: () => {},
        onError: (e) => {
          console.error(e);
        },
      }
    );
  }

  function onToggleRun(id: string) {
    setSelectedRunIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onOpenSegment(runId: string) {
    // TODO: open modal with segments of the run
  }

  function onExportCsv() {}

  return (
    <div className="h-screen grid grid-cols-[320px_1fr]">
      <aside className="border-r p-4 overflow-y-auto">
        <ParamsPanel defaultScenario={{}} onStart={onStart} />
      </aside>
      <main className="flex flex-col min-w-0">
        <HeaderKpiBar scenario={scenario!} kpiStatus={kpiStatus} kpiText={kpiText} />
        <Tabs tabs={["Live","Summary","Distributions","Runs","Logs"]} active={activeTab} onChange={setActiveTab}>
          {activeTab === "Live" && <LivePane current={current} recent={recent} />}
          {activeTab === "Summary" && scenario && <SummaryPane scenario={scenario} metrics={metrics} />}
          {activeTab === "Distributions" && <DistributionsPane runs={runs} selectedRunIds={selectedRunIds} onToggleRun={onToggleRun} />}
          {activeTab === "Runs" && <RunsPane runs={runs} onOpenSegment={onOpenSegment} onExportCsv={onExportCsv} />}
          {activeTab === "Logs" && <LogsPane segments={recent} filter={logFilter} onFilter={setLogFilter} />}
        </Tabs>
      </main>
    </div>
  );
}
