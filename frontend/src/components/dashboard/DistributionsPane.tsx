"use client";
import React from "react";
import { Run } from "@/types/experiment";
import { ResponsiveContainer } from "recharts";

type Props = { runs: Run[]; selectedRunIds: string[]; onToggleRun: (id: string) => void };

export default function DistributionsPane({ runs, selectedRunIds, onToggleRun }: Props) {
  const selected = runs.filter((r) => selectedRunIds.includes(r.id));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {runs.slice(0, 5).map((r) => (
          <label key={r.id} className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedRunIds.includes(r.id)} onChange={() => onToggleRun(r.id)} />
            <span className="px-2 py-1 rounded bg-gray-100">{r.scenario.frame}/{r.scenario.pace}/{r.scenario.threads}</span>
          </label>
        ))}
      </div>

      {/* 분포 시각화 제거: ASL/ASL% KPI만 남김 */}
    </div>
  );
}

function histData(selected: Run[], key: 'stt'|'tx'|'ui') {
  const all = selected.flatMap((r) => r.segments.map((s) => s[key]));
  const max = Math.max(100, ...all, 0);
  const step = Math.max(50, Math.round(max / 20));
  const bins: Record<number, number> = {};
  for (const v of all) {
    const b = Math.floor(v / step) * step;
    bins[b] = (bins[b] ?? 0) + 1;
  }
  return Object.entries(bins).map(([b, c]) => ({ bin: `${b}-${Number(b) + step}`, count: c }));
}

