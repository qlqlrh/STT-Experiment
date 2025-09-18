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
import { evaluateKpi, type KpiMetrics, type KpiResult } from "@/utils/metrics";

export default function Home() {
  const [activeTab, setActiveTab] = useState("Live");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [current, setCurrent] = useState<Segment | null>(null);
  const [recent, setRecent] = useState<Segment[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<"all"|"failed"|"dropped">("all");
  const [audioDurationMs, setAudioDurationMs] = useState<number | null>(null);
  const [lastKpiMetrics, setLastKpiMetrics] = useState<KpiMetrics | null>(null);
  const [lastKpiResult, setLastKpiResult] = useState<KpiResult | null>(null);
  const savedRunIdsRef = React.useRef<Set<string>>(new Set());

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

  const { kpiMetrics, kpiResult } = useMemo((): { kpiMetrics: KpiMetrics | null; kpiResult: KpiResult | null } => {
    if (!audioDurationMs) return { kpiMetrics: null, kpiResult: null };
    const seg = recent[0] || current;
    if (!seg || typeof seg.e2e !== 'number') return { kpiMetrics: null, kpiResult: null };
    const dur = audioDurationMs;
    const asl = (seg.e2e - dur) / 1000;
    const aslPercent = ((seg.e2e - dur) / Math.max(1, dur)) * 100;
    const rtfVal = seg.e2e / Math.max(1, dur);
    const ttftVal = (((seg.t2 ?? 0) - (seg.t1 ?? 0)) + (seg.tx ?? 0)) / 1000;
    const k: KpiMetrics = {
      asl: { mean: asl, p95: asl },
      aslPercent: { mean: aslPercent, p95: aslPercent },
      rtf: { mean: rtfVal, p95: rtfVal },
      ttft: { p95: Number.isFinite(ttftVal) && ttftVal >= 0 ? ttftVal : 0 },
    };
    return { kpiMetrics: k, kpiResult: evaluateKpi(k) };
  }, [audioDurationMs, recent, current]);

  // Live에서 계산된 최신 KPI 스냅샷 보관 (Run 저장 시 그대로 사용)
  React.useEffect(() => {
    if (kpiMetrics && kpiResult) {
      setLastKpiMetrics(kpiMetrics);
      setLastKpiResult(kpiResult);
    }
  }, [kpiMetrics, kpiResult]);

  const { kpiText, kpiStatus } = useMemo(() => {
    if (!kpiResult) return { kpiText: "—", kpiStatus: "fail" as const };
    const overall = kpiResult.overall;
    const badge = overall.toUpperCase();
    return { kpiText: `${badge} · 종합 KPI`, kpiStatus: overall === "PASS" ? ("pass" as const) : overall === "WARN" ? ("warn" as const) : ("fail" as const) };
  }, [kpiResult]);

  async function onStart(s: Scenario, file: File) {
    setScenario(s);
    setCurrent(null);
    setRecent([]);
    // 오디오 길이(ms) 계산 (가변 길이 보정용)
    try {
      const ab = await file.arrayBuffer();
      const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtor();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      setAudioDurationMs((buf.duration || 0) * 1000);
      ctx.close?.();
    } catch {
      setAudioDurationMs(null);
    }

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
        onSegmentUpdate: (seg: any) => {
          setCurrent((prev) => ({
            id: segmentId,
            t1: seg.t1 ?? prev?.t1 ?? 0,
            t2: seg.t2 ?? prev?.t2 ?? 0,
            t3: seg.t3 ?? prev?.t3 ?? 0,
            t4: seg.t4 ?? prev?.t4 ?? 0,
            t5: seg.t5 ?? prev?.t5 ?? 0,
            e2e: seg.e2e ?? prev?.e2e,
            stt: seg.stt ?? prev?.stt,
            tx: seg.tx ?? prev?.tx,
            ui: seg.ui ?? prev?.ui,
            transcript: seg.transcript ?? prev?.transcript,
            droppedFrames: seg.dropRate !== undefined ? Math.round((seg.dropRate || 0) * 1000) : prev?.droppedFrames,
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
                tx: seg.tx ?? (current as any)?.tx ?? 0,
                ui: seg.ui ?? 0,
                t1: seg.t1!,
                t2: seg.t2 ?? (current as any)?.t2 ?? seg.t1!,
                t3: seg.t3 ?? (current as any)?.t3 ?? seg.t2 ?? seg.t1!,
                t4: seg.t4 ?? (current as any)?.t4 ?? seg.t3 ?? seg.t2 ?? seg.t1!,
                t5: seg.t5!,
                droppedFrames: seg.dropRate !== undefined ? Math.round((seg.dropRate || 0) * 1000) : (current as any)?.droppedFrames,
                t1Epoch: seg.t1Epoch ?? (current as any)?.t1Epoch,
                t2Epoch: seg.t2Epoch ?? (current as any)?.t2Epoch,
                t3Epoch: seg.t3Epoch ?? (current as any)?.t3Epoch,
                t4Epoch: seg.t4Epoch ?? (current as any)?.t4Epoch,
                t5Epoch: seg.t5Epoch ?? (current as any)?.t5Epoch,
              },
              ...r,
            ].slice(0, 200));

            // Live에 결과가 뜨는 즉시 Run에도 1회 결과를 기록 (중복 방지)
            if (!savedRunIdsRef.current.has(segmentId) && audioDurationMs) {
              const segForRun = {
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
              } as Segment;

              const singleMetrics: Metrics = {
                n: 1,
                e2e: { mean: segForRun.e2e, p95: segForRun.e2e, std: 0 } as any,
                stt: { mean: segForRun.stt, p95: segForRun.stt } as any,
                tx: { mean: segForRun.tx, p95: segForRun.tx } as any,
                ui: { mean: segForRun.ui, p95: segForRun.ui } as any,
                dropRate: typeof seg.dropRate === 'number' ? seg.dropRate : undefined,
              } as any;

              const dur = audioDurationMs;
              const asl = (segForRun.e2e - dur) / 1000;
              const aslPercent = ((segForRun.e2e - dur) / Math.max(1, dur)) * 100;
              const rtfVal = segForRun.e2e / Math.max(1, dur);
              const ttftVal = (((segForRun.t2 ?? 0) - (segForRun.t1 ?? 0)) + (segForRun.tx ?? 0)) / 1000;
              const kpiM: KpiMetrics = { asl: { mean: asl, p95: asl }, aslPercent: { mean: aslPercent, p95: aslPercent }, rtf: { mean: rtfVal, p95: rtfVal }, ttft: { p95: ttftVal } };
              const kpiR: KpiResult = evaluateKpi(kpiM);

              const runId = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
              const status = kpiR.overall === 'PASS' ? 'pass' : kpiR.overall === 'WARN' ? 'warn' : 'fail';
              const run: Run = { id: runId, startedAt: Date.now(), scenario: s as Scenario, metrics: singleMetrics, status, segments: [segForRun], kpiMetrics: kpiM, kpiResult: kpiR };
              setRuns((prev) => [run, ...prev]);
              savedRunIdsRef.current.add(segmentId);
            }
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
        <HeaderKpiBar scenario={scenario} kpiStatus={kpiStatus} kpiText={kpiText} />
        <Tabs tabs={["Live","Summary","Distributions","Runs","Logs"]} active={activeTab} onChange={setActiveTab}>
          {activeTab === "Live" && <LivePane current={current} recent={recent} kpiMetrics={kpiMetrics ?? undefined} kpiResult={kpiResult ?? undefined} />}
          {activeTab === "Summary" && scenario && <SummaryPane scenario={scenario} metrics={metrics} kpiMetrics={kpiMetrics ?? undefined} kpiResult={kpiResult ?? undefined} />}
          {activeTab === "Distributions" && <DistributionsPane runs={runs} selectedRunIds={selectedRunIds} onToggleRun={onToggleRun} />}
          {activeTab === "Runs" && <RunsPane runs={runs} onOpenSegment={onOpenSegment} onExportCsv={onExportCsv} />}
          {activeTab === "Logs" && <LogsPane segments={recent} filter={logFilter} onFilter={setLogFilter} />}
        </Tabs>
      </main>
    </div>
  );
}
