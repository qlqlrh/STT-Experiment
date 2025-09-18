"use client";
import React from "react";
import { Segment } from "@/types/experiment";

type Filter = "all" | "failed" | "dropped";
type Props = { segments: Segment[]; filter: Filter; onFilter: (f: Filter) => void };

export default function LogsPane({ segments, filter, onFilter }: Props) {
  const filtered = segments.filter((s) => {
    if (filter === "dropped") return (s.droppedFrames ?? 0) > 0;
    if (filter === "failed") return false; // placeholder: mark failed by custom rule if needed
    return true;
  });
  return (
    <div className="grid gap-3">
      <div className="flex gap-2 text-sm">
        {(["all","failed","dropped"] as Filter[]).map((f) => (
          <button key={f} className={`px-3 py-1 rounded border ${filter === f ? 'bg-gray-200' : 'bg-white'}`} onClick={() => onFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        {filtered.map((s) => (
          <div key={s.id} className="rounded-lg border bg-white p-3 grid gap-1">
            <div className="text-xs text-gray-500">{s.id}</div>
            <div className="text-sm tabular">T1 {s.t1} · T2 {s.t2} · T3 {s.t3} · T4 {s.t4} · T5 {s.t5}</div>
            <div className="text-sm tabular">E2E {s.e2e} · STT {s.stt} · Tx {s.tx} · UI {s.ui}</div>
            {s.transcript && <div className="text-sm text-gray-700 line-clamp-2">{s.transcript}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

