"use client";
import React from "react";
import { Run } from "@/types/experiment";
import { downloadCsv, toCsv } from "@/utils/csv";

type Props = { runs: Run[]; onOpenSegment: (runId: string) => void; onExportCsv: () => void };

export default function RunsPane({ runs, onOpenSegment, onExportCsv }: Props) {
  const exportCsv = () => {
    const headers = [
      "startedAt","filename","frame","pace","threads","buffer","capacity","win","hop",
      "dropRate","status",
      "ASL_mean_s","ASL%_mean","RTF_mean","TTFT_p95_s","KPI_overall","KPI_asl","KPI_aslPercent","KPI_rtf","KPI_ttft"
    ];
    const rows = runs.map((r) => [
      new Date(r.startedAt).toISOString(),
      r.scenario.filename,
      r.scenario.frame,
      r.scenario.pace,
      r.scenario.threads,
      r.scenario.buffer,
      r.scenario.capacity,
      r.scenario.win,
      r.scenario.hop,
      (typeof r.metrics.dropRate === 'number' ? r.metrics.dropRate : 0),
      r.status,
      r.kpiMetrics ? r.kpiMetrics.asl.mean.toFixed(2) : "",
      r.kpiMetrics ? r.kpiMetrics.aslPercent.mean.toFixed(1) : "",
      r.kpiMetrics ? r.kpiMetrics.rtf.mean.toFixed(2) : "",
      formatTtft(r),
      r.kpiResult?.overall ?? "",
      r.kpiResult?.asl ?? "",
      r.kpiResult?.aslPercent ?? "",
      r.kpiResult?.rtf ?? "",
      r.kpiResult?.ttft ?? "",
    ]);
    downloadCsv("runs.csv", toCsv(headers, rows));
    onExportCsv();
  };

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm" onClick={exportCsv}>CSV 다운로드</button>
      </div>
      <div className="overflow-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              {['시작시각','파일명','frame','pace','threads','buffer(cap)','win/hop','drop','ASL(s)','ASL%','RTF','TTFT(s)','KPI'].map((h) => (
                <th key={h} className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => onOpenSegment(r.id)}>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.scenario.filename}</td>
                <td className="px-3 py-2">{r.scenario.frame}</td>
                <td className="px-3 py-2">{r.scenario.pace}</td>
                <td className="px-3 py-2">{r.scenario.threads}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.scenario.buffer}({r.scenario.capacity})</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.scenario.win}/{r.scenario.hop}</td>
                <td className="px-3 py-2 tabular">{((typeof r.metrics.dropRate === 'number' ? r.metrics.dropRate : 0) * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 tabular">{r.kpiMetrics ? r.kpiMetrics.asl.mean.toFixed(2) : ''}</td>
                <td className="px-3 py-2 tabular">{r.kpiMetrics ? r.kpiMetrics.aslPercent.mean.toFixed(1) + '%' : ''}</td>
                <td className="px-3 py-2 tabular">{r.kpiMetrics ? r.kpiMetrics.rtf.mean.toFixed(2) : ''}</td>
                <td className="px-3 py-2 tabular">{formatTtft(r)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${badge(r.status)}`}>{r.status.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function badge(s: Run['status']) {
  return s === 'pass' ? 'bg-green-100 text-green-700' : s === 'warn' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
}

function formatTtft(r: Run): string {
  const k = r.kpiMetrics;
  if (k && typeof k.ttft?.p95 === 'number') return Number(k.ttft.p95).toFixed(2);
  // fallback: segments에서 TTFT 근사 (T2-T1 + tx)
  const vals = (r.segments || [])
    .map((s) => {
      const t2 = s.t2 ?? 0; const t1 = s.t1 ?? 0; const tx = s.tx ?? 0;
      const v = (t2 - t1) + tx; // ms
      return Number.isFinite(v) && v >= 0 ? v : undefined;
    })
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return '';
  // 간단히 상위 95% 위치 근사
  const sorted = [...vals].sort((a,b) => a-b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return (sorted[idx] / 1000).toFixed(2);
}