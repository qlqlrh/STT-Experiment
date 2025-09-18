"use client";
import React from "react";
import { Run } from "@/types/experiment";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar } from "recharts";
import { cdf } from "@/utils/stats";

type Props = { runs: Run[]; selectedRunIds: string[]; onToggleRun: (id: string) => void };

export default function DistributionsPane({ runs, selectedRunIds, onToggleRun }: Props) {
  const selected = runs.filter((r) => selectedRunIds.includes(r.id));
  const series = selected.map((r) => ({ id: r.id, name: `${r.scenario.frame}/${r.scenario.pace}/${r.scenario.threads}`, data: cdf(r.segments.map((s) => s.e2e)) }));

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

      <div className="rounded-lg border bg-white p-4 h-72">
        <div className="text-sm text-gray-600 mb-2">E2E CDF</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <XAxis type="number" domain={[0, 'auto']} dataKey="x" unit="ms" />
            <YAxis type="number" domain={[0, 100]} unit="%" />
            <Tooltip />
            <Legend />
            <ReferenceLine x={2500} stroke="#ef4444" strokeDasharray="4 4" />
            {series.map((s, i) => (
              <Line key={s.id} data={s.data} dataKey="y" name={s.name} dot={false} strokeWidth={2} stroke={["#6366f1", "#22c55e", "#eab308"][i % 3]} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {['stt', 'tx', 'ui'].map((k) => (
          <div key={k} className="rounded-lg border bg-white p-4 h-56">
            <div className="text-sm text-gray-600 mb-2">{k.toUpperCase()} Histogram</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histData(selected, k as 'stt'|'tx'|'ui')}>
                <XAxis dataKey="bin" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
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

