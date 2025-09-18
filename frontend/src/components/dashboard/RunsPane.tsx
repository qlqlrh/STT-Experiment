"use client";
import React from "react";
import { Run } from "@/types/experiment";
import { downloadCsv, toCsv } from "@/utils/csv";

type Props = { runs: Run[]; onOpenSegment: (runId: string) => void; onExportCsv: () => void };

export default function RunsPane({ runs, onOpenSegment, onExportCsv }: Props) {
  const exportCsv = () => {
    const headers = ["startedAt","filename","frame","pace","threads","buffer","capacity","win","hop","n","e2e_mean","e2e_p95","stt_p95","dropRate","status"];
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
      r.metrics.n,
      Math.round(r.metrics.e2e.mean),
      Math.round(r.metrics.e2e.p95),
      Math.round(r.metrics.stt.p95),
      r.metrics.dropRate ?? "",
      r.status,
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
              {['시작시각','파일명','frame','pace','threads','buffer(cap)','win/hop','n','E2E mean','E2E P95','STT P95','drop','KPI'].map((h) => (
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
                <td className="px-3 py-2 tabular">{r.metrics.n}</td>
                <td className="px-3 py-2 tabular">{Math.round(r.metrics.e2e.mean)}</td>
                <td className="px-3 py-2 tabular">{Math.round(r.metrics.e2e.p95)}</td>
                <td className="px-3 py-2 tabular">{Math.round(r.metrics.stt.p95)}</td>
                <td className="px-3 py-2 tabular">{r.metrics.dropRate ? (r.metrics.dropRate * 100).toFixed(1) + '%' : ''}</td>
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

