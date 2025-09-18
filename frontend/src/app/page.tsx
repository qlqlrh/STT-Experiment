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
  function computeKpiFromSegment(durationMs: number, seg: { e2e: number; t1?: number; t4?: number; stt?: number }): { kpiMetrics: KpiMetrics; kpiResult: KpiResult } {
    const dur = durationMs;
    const e2eMs = seg.e2e;
    const aslMs = Math.max(0, e2eMs - dur);
    const asl = aslMs / 1000;
    const aslPercent = (aslMs / Math.max(1, dur)) * 100;
    const rtfVal = seg.stt ? seg.stt / Math.max(1, dur) : 0;
    const ttftMs = (seg.t4 ?? 0) - (seg.t1 ?? 0);
    const ttftVal = Math.max(0, ttftMs) / 1000;
    const k: KpiMetrics = {
      asl: { mean: asl, p95: asl },
      aslPercent: { mean: aslPercent, p95: aslPercent },
      rtf: { mean: rtfVal, p95: rtfVal },
      ttft: { p95: Number.isFinite(ttftVal) ? ttftVal : 0 },
    };
    return { kpiMetrics: k, kpiResult: evaluateKpi(k) };
  }
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
  const runsLenRef = React.useRef<number>(0);
  const batchRunningRef = React.useRef<boolean>(false);
  const [batchTotals, setBatchTotals] = useState<{ combos: number; repeats: number } | null>(null);
  const [batchPosition, setBatchPosition] = useState<{ comboIndex: number; repeatIndex: number } | null>(null);

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
    return computeKpiFromSegment(audioDurationMs, { e2e: seg.e2e, t1: seg.t1, t4: seg.t4, stt: seg.stt });
  }, [audioDurationMs, recent, current]);

  React.useEffect(() => {
    runsLenRef.current = runs.length;
  }, [runs.length]);

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

  const progressText = useMemo(() => {
    if (!batchTotals || !batchPosition) return undefined;
    const pIdx = batchPosition.comboIndex + 1;
    const pTot = batchTotals.combos;
    const rIdx = batchPosition.repeatIndex + 1;
    const rTot = batchTotals.repeats;
    return `Param ${pIdx}/${pTot} · Repeat ${rIdx}/${rTot}`;
  }, [batchTotals, batchPosition]);

  async function onStart(s: Scenario, file: File): Promise<void> {
    setScenario(s);
    setCurrent(null);
    setRecent([]);
    // 오디오 길이(ms) 계산 (가변 길이 보정용)
    let durationMsLocal: number | null = null;
    try {
      const ab = await file.arrayBuffer();
      const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtor();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      durationMsLocal = (buf.duration || 0) * 1000;
      setAudioDurationMs(durationMsLocal);
      ctx.close?.();
    } catch {
      setAudioDurationMs(null);
    }

    const segmentId = "seg-" + Math.random().toString(36).slice(2, 8);

    // 이 실행이 Run에 기록되면 resolve되는 Promise 구성
    const done = new Promise<void>((resolve) => {
      const handler = (e: any) => {
        if (e?.detail === segmentId) {
          try { window.removeEventListener('run-added', handler as any); } catch {}
          resolve();
        }
      };
      window.addEventListener('run-added', handler as any);
      setTimeout(() => { try { window.removeEventListener('run-added', handler as any); } catch {}; resolve(); }, 30000);
    });
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
          let nextCurrentLocal: Segment | null = null as any;
          setCurrent((prev) => {
            const nc = {
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
            } as Segment;
            nextCurrentLocal = nc;
            return nc;
          });
          if (seg.e2e !== undefined) {
            setRecent((r) => [
              {
                ...(nextCurrentLocal ?? ({} as any)),
                id: segmentId,
                e2e: seg.e2e!,
                stt: seg.stt ?? (nextCurrentLocal as any)?.stt ?? 0,
                tx: seg.tx ?? (nextCurrentLocal as any)?.tx ?? 0,
                ui: seg.ui ?? (nextCurrentLocal as any)?.ui ?? 0,
                t1: seg.t1 ?? (nextCurrentLocal as any)?.t1!,
                t2: seg.t2 ?? (nextCurrentLocal as any)?.t2 ?? (nextCurrentLocal as any)?.t1!,
                t3: seg.t3 ?? (nextCurrentLocal as any)?.t3 ?? (nextCurrentLocal as any)?.t2 ?? (nextCurrentLocal as any)?.t1!,
                t4: seg.t4 ?? (nextCurrentLocal as any)?.t4 ?? (nextCurrentLocal as any)?.t3 ?? (nextCurrentLocal as any)?.t2 ?? (nextCurrentLocal as any)?.t1!,
                t5: seg.t5!,
                droppedFrames: seg.dropRate !== undefined ? Math.round((seg.dropRate || 0) * 1000) : (nextCurrentLocal as any)?.droppedFrames,
                t1Epoch: seg.t1Epoch ?? (nextCurrentLocal as any)?.t1Epoch,
                t2Epoch: seg.t2Epoch ?? (nextCurrentLocal as any)?.t2Epoch,
                t3Epoch: seg.t3Epoch ?? (nextCurrentLocal as any)?.t3Epoch,
                t4Epoch: seg.t4Epoch ?? (nextCurrentLocal as any)?.t4Epoch,
                t5Epoch: seg.t5Epoch ?? (nextCurrentLocal as any)?.t5Epoch,
              },
              ...r,
            ].slice(0, 200));

            // Live에 결과가 뜨는 즉시 Run에도 1회 결과를 기록 (중복 방지)
            if (!savedRunIdsRef.current.has(segmentId)) {
              const segForRun = {
                id: segmentId,
                e2e: seg.e2e!,
                stt: seg.stt ?? (nextCurrentLocal as any)?.stt ?? 0,
                tx: seg.tx ?? (nextCurrentLocal as any)?.tx ?? 0,
                ui: seg.ui ?? (nextCurrentLocal as any)?.ui ?? 0,
                t1: seg.t1 ?? (nextCurrentLocal as any)?.t1!,
                t2: seg.t2 ?? (nextCurrentLocal as any)?.t2 ?? (nextCurrentLocal as any)?.t1!,
                t3: seg.t3 ?? (nextCurrentLocal as any)?.t3 ?? (nextCurrentLocal as any)?.t2 ?? (nextCurrentLocal as any)?.t1!,
                t4: seg.t4 ?? (nextCurrentLocal as any)?.t4 ?? (nextCurrentLocal as any)?.t3 ?? (nextCurrentLocal as any)?.t2 ?? (nextCurrentLocal as any)?.t1!,
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

              let status: Run['status'] = 'fail';
              let kpiM: KpiMetrics | undefined = undefined;
              let kpiR: KpiResult | undefined = undefined;
              const dur = typeof durationMsLocal === 'number' && durationMsLocal > 0 ? durationMsLocal : (typeof audioDurationMs === 'number' ? audioDurationMs : null);
              if (typeof dur === 'number' && dur > 0) {
                const computed = computeKpiFromSegment(dur, { e2e: segForRun.e2e, t1: segForRun.t1, t4: segForRun.t4, stt: segForRun.stt });
                kpiM = computed.kpiMetrics;
                kpiR = computed.kpiResult;
                status = kpiR.overall === 'PASS' ? 'pass' : kpiR.overall === 'WARN' ? 'warn' : 'fail';
              }

              const runId = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
              const run: Run = { id: runId, startedAt: Date.now(), scenario: s as Scenario, metrics: singleMetrics, status, segments: [segForRun], kpiMetrics: kpiM, kpiResult: kpiR } as Run;
              setRuns((prev) => [run, ...prev]);
              savedRunIdsRef.current.add(segmentId);
              try { window.dispatchEvent(new CustomEvent('run-added', { detail: segmentId })); } catch {}
            }
          }
        },
        onCompleted: () => {},
        onError: (e) => {
          console.error(e);
        },
      }
    );
    return done;
  }

  // 배치 실행: 조합 배열을 순차로 돌며 각 조합을 repeats회 실행
  async function runBatch(combos: Scenario[], repeats: number, file: File) {
    batchRunningRef.current = true;
    setBatchTotals({ combos: combos.length, repeats });
    setBatchPosition({ comboIndex: 0, repeatIndex: 0 });
    for (const combo of combos) {
      const comboIdx = combos.indexOf(combo);
      for (let i = 0; i < repeats; i++) {
        setBatchPosition({ comboIndex: comboIdx, repeatIndex: i });
        await onStart(combo, file);
      }
    }
    batchRunningRef.current = false;
    setBatchTotals(null);
    setBatchPosition(null);
  }

  // 전역 노출: 콘솔에서 window.runBatch(combos, 10, file)
  React.useEffect(() => {
    (window as any).runBatch = runBatch;
    (window as any).getRunsLen = () => runsLenRef.current;
    (window as any).isBatchRunning = () => batchRunningRef.current;
    return () => { try { delete (window as any).runBatch; } catch {}
    };
  }, [runs.length]);

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
        <ParamsPanel
          defaultScenario={{}}
          onStart={onStart}
          onStartBatch={(file) => {
            const base = { win: 2.0, hop: 0.5, lang: "ko-KR", filename: file.name } as const;
            const frames = [2048, 4096, 8192] as const;
            const buffers = [
              { buffer: "unbounded" as const, capacity: 0 },
              { buffer: "bounded_drop_newest" as const, capacity: 16 },
            ];
            const threads = [1, 2] as const;
            const paces = ["realtime", "fast"] as const;
            const combos: Scenario[] = [] as any;
            for (const frame of frames)
            for (const b of buffers)
            for (const th of threads)
            for (const pace of paces) {
              combos.push({ ...base, frame, threads: th, buffer: b.buffer, capacity: b.capacity, pace } as any);
            }
            runBatch(combos, 5, file);
          }}
        />
      </aside>
      <main className="flex flex-col min-w-0">
        <HeaderKpiBar scenario={scenario} kpiStatus={kpiStatus} kpiText={kpiText} progressText={progressText} />
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
