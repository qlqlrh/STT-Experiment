"use client";
import React from "react";
import { Segment } from "@/types/experiment";

type Filter = "all";
type Props = { segments: Segment[]; filter: Filter; onFilter: (f: Filter) => void };

export default function LogsPane({ segments, filter, onFilter }: Props) {
  const filtered = segments;
  return (
    <div className="grid gap-3">
      {/* 필터/드롭 표시 제거 */}
      <div className="grid gap-2">
        {filtered.map((s) => (
          <div key={s.id} className="rounded-lg border bg-white p-3 grid gap-1">
            <div className="text-xs text-gray-500">{s.id}</div>
            <div className="text-sm tabular">T1 {s.t1} · T2 {s.t2} · T3 {s.t3} · T4 {s.t4} · T5 {s.t5}</div>
            {s.transcript && <div className="text-sm text-gray-700 line-clamp-2">{s.transcript}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

