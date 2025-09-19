"use client";
import React from "react";
import { Metrics, Scenario } from "@/types/experiment";
import { DESCRIPTIONS, type KpiMetrics, type KpiResult } from "@/utils/metrics";

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
      {/* KPI 카드(요약) 제거: ASL/ASL%만 아래 배지에서 표시 */}
      {kpiMetrics && kpiResult && (
        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium mb-2">KPI 종합 결과</div>
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className={`px-2 py-0.5 rounded text-xs ${kpiResult.overall === 'PASS' ? 'bg-green-100 text-green-700' : kpiResult.overall === 'WARN' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{kpiResult.overall}</span>
            <span className="text-gray-600">가변 길이 보정 기준으로 산출</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <MetricBadge title="ASL" desc={DESCRIPTIONS.asl} level={kpiResult.asl} main={`${kpiMetrics.asl.mean.toFixed(2)}s`} />
            <MetricBadge title="ASL%" desc={DESCRIPTIONS.aslPercent} level={kpiResult.aslPercent} main={`${kpiMetrics.aslPercent.mean.toFixed(1)}%`} />
          </div>
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

