"use client";
import React from "react";
import { Metrics, Scenario } from "@/types/experiment";
import { DESCRIPTIONS, type KpiMetrics, type KpiResult } from "@/utils/metrics";
import { METRIC_DESCRIPTIONS } from "@/constants/descriptions";

type Props = { scenario: Scenario; metrics: Metrics; kpiMetrics?: KpiMetrics; kpiResult?: KpiResult };

const KPI_MEAN = 1500;
const KPI_P95 = 2500;

export default function SummaryPane({ scenario, metrics, kpiMetrics, kpiResult }: Props) {
  const statusColor = (mean: number, p95: number) => {
    if (mean <= KPI_MEAN && p95 <= KPI_P95) return "bg-green-100 text-green-700";
    if (mean <= KPI_MEAN * 1.2 && p95 <= KPI_P95 * 1.2) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };
  return (
    <div className="grid gap-4">
      <div className="text-sm text-gray-600">
        frame={scenario.frame} | pace={scenario.pace} | threads={scenario.threads} | buffer={scenario.buffer}({scenario.capacity}) | win={scenario.win}/hop={scenario.hop}
      </div>
      <div className="rounded-md bg-indigo-50 border border-indigo-100 p-3 text-[13px] leading-5 text-indigo-900">
        <div className="font-medium mb-1">지표 해설</div>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><b>{METRIC_DESCRIPTIONS.e2e.title}</b> — {METRIC_DESCRIPTIONS.e2e.desc} (공식: {METRIC_DESCRIPTIONS.e2e.formula})</li>
          <li><b>{METRIC_DESCRIPTIONS.sttProc.title}</b> — {METRIC_DESCRIPTIONS.sttProc.desc} (공식: {METRIC_DESCRIPTIONS.sttProc.formula})</li>
          <li><b>{METRIC_DESCRIPTIONS.txPipe.title}</b> — {METRIC_DESCRIPTIONS.txPipe.desc} (공식: {METRIC_DESCRIPTIONS.txPipe.formula})</li>
          <li><b>{METRIC_DESCRIPTIONS.uiApply.title}</b> — {METRIC_DESCRIPTIONS.uiApply.desc} (공식: {METRIC_DESCRIPTIONS.uiApply.formula})</li>
        </ul>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard title="E2E" mean={metrics.e2e.mean} p95={metrics.e2e.p95} std={metrics.e2e.std} n={metrics.n} badgeClass={statusColor(metrics.e2e.mean, metrics.e2e.p95)} />
        <KpiCard title="STT" mean={metrics.stt.mean} p95={metrics.stt.p95} n={metrics.n} />
        <KpiCard title="Tx" mean={metrics.tx.mean} p95={metrics.tx.p95} n={metrics.n} />
        <KpiCard title="UI" mean={metrics.ui.mean} p95={metrics.ui.p95} n={metrics.n} />
      </div>
      {kpiMetrics && kpiResult && (
        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium mb-2">KPI 종합 결과</div>
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className={`px-2 py-0.5 rounded text-xs ${kpiResult.overall === 'PASS' ? 'bg-green-100 text-green-700' : kpiResult.overall === 'WARN' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{kpiResult.overall}</span>
            <span className="text-gray-600">가변 길이 보정 기준으로 산출</span>
          </div>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <MetricBadge title="ASL" desc={DESCRIPTIONS.asl} level={kpiResult.asl} main={`${kpiMetrics.asl.mean.toFixed(2)}s`} />
            <MetricBadge title="ASL%" desc={DESCRIPTIONS.aslPercent} level={kpiResult.aslPercent} main={`${kpiMetrics.aslPercent.mean.toFixed(1)}%`} />
            <MetricBadge title="RTF" desc={DESCRIPTIONS.rtf} level={kpiResult.rtf} main={`${kpiMetrics.rtf.mean.toFixed(2)}`} />
            <MetricBadge title="TTFT" desc={DESCRIPTIONS.ttft} level={kpiResult.ttft} main={`${kpiMetrics.ttft.p95.toFixed(2)}s`} />
          </div>
        </div>
      )}
      <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
        E2E distribution summary: median ~ {Math.round((metrics.e2e.mean + metrics.e2e.p95) / 2)} ms, P95 {Math.round(metrics.e2e.p95)} ms
      </div>
      {metrics.dropRate !== undefined && (
        <div className="rounded-lg border bg-white p-4 text-sm grid gap-2">
          <div>Drop Rate: {(metrics.dropRate * 100).toFixed(2)}%</div>
          {metrics.maxQueueDepthP95 !== undefined && <div>Queue Depth P95: {metrics.maxQueueDepthP95}</div>}
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, mean, p95, n, std, badgeClass }: { title: string; mean: number; p95: number; n: number; std?: number; badgeClass?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        {badgeClass && <div className={`px-2 py-0.5 rounded text-xs ${badgeClass}`}>{p95 <= 2500 && mean <= 1500 ? "PASS" : p95 <= 3000 ? "WARN" : "FAIL"}</div>}
      </div>
      <div className="mt-2 grid gap-1 tabular">
        <div className="text-2xl font-semibold">{Math.round(mean)} ms</div>
        <div className="text-sm text-gray-500">P95 {Math.round(p95)} ms · n={n}{std !== undefined ? ` · std ${Math.round(std)}` : ""}</div>
      </div>
    </div>
  );
}

function MetricBadge({ title, desc, level, main }: { title: string; desc: string; level: 'PASS' | 'WARN' | 'FAIL'; main: string }) {
  const cls = level === 'PASS' ? 'bg-green-50 border-green-100' : level === 'WARN' ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100';
  const badge = level === 'PASS' ? 'bg-green-100 text-green-700' : level === 'WARN' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium">{title}</div>
        <span className={`px-2 py-0.5 rounded text-xs ${badge}`}>{level}</span>
      </div>
      <div className="text-lg font-semibold">{main}</div>
      <div className="mt-1 text-[12px] text-gray-600">{desc}</div>
    </div>
  );
}

