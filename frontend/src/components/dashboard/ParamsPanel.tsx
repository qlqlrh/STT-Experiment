"use client";
import React, { useMemo, useState } from "react";
import { Scenario } from "@/types/experiment";
import { listPresets, loadPreset, savePreset } from "@/utils/presets";

type Props = {
  defaultScenario?: Partial<Scenario>;
  onStart: (s: Scenario, file: File) => void;
  onStartBatch?: (file: File) => void;
  onSavePreset?: (name: string, s: Scenario) => void;
  onLoadPreset?: (name: string, s: Scenario) => void;
};

export default function ParamsPanel({ defaultScenario, onStart, onStartBatch, onSavePreset, onLoadPreset }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [scenario, setScenario] = useState<Scenario>({
    frame: defaultScenario?.frame ?? 4096,
    pace: defaultScenario?.pace ?? "realtime",
    threads: defaultScenario?.threads ?? 1,
    buffer: defaultScenario?.buffer ?? "unbounded",
    capacity: defaultScenario?.capacity ?? 0,
    win: defaultScenario?.win ?? 2.0,
    hop: defaultScenario?.hop ?? 0.5,
    lang: defaultScenario?.lang ?? "ko-KR",
    filename: defaultScenario?.filename ?? "",
  });

  const presetNames = useMemo(() => listPresets(), []);

  const start = () => {
    if (!file) return;
    onStart({ ...scenario, filename: file.name }, file);
  };

  const save = () => {
    const name = prompt("Preset name?");
    if (!name) return;
    savePreset(name, scenario);
    onSavePreset?.(name, scenario);
  };

  const load = () => {
    const name = prompt("Load preset name?\n" + presetNames.join(", "));
    if (!name) return;
    const s = loadPreset(name);
    if (s) {
      setScenario(s);
      onLoadPreset?.(name, s);
    }
  };

  const inputCls = "px-2 py-1 border rounded-md text-sm w-full";
  const labelCls = "text-xs text-gray-600";

  return (
    <div className="grid gap-3">
      <div>
        <div className={labelCls}>Audio File</div>
        <input className={inputCls} type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Language</span>
            <span className="tooltip" data-tip="STT 언어 코드 (예: en-US, ko-KR)">?</span>
          </div>
          <input className={inputCls} value={scenario.lang} onChange={(e) => setScenario({ ...scenario, lang: e.target.value })} />
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Pace</span>
            <span className="tooltip" data-tip="realtime: 프레임 간 대기 포함\nfast: 가능한 한 빠르게 전송">?</span>
          </div>
          <select className={inputCls} value={scenario.pace} onChange={(e) => setScenario({ ...scenario, pace: e.target.value as any })}>
            <option value="realtime">realtime</option>
            <option value="fast">fast</option>
          </select>
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Frame</span>
            <span className="tooltip" data-tip="오디오 샘플 단위 프레임 크기\n(16kHz 기준 16000 ≈ 1초)">?</span>
          </div>
          <input
            className={inputCls}
            type="number"
            value={Number.isNaN(scenario.frame as any) ? '' : scenario.frame}
            onChange={(e) => {
              const v = e.target.value;
              setScenario({ ...scenario, frame: v === '' ? 0 : (parseInt(v, 10) || 0) });
            }}
          />
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Threads</span>
            <span className="tooltip" data-tip="전송 워커 개수(병렬 전송 레벨)">?</span>
          </div>
          <input
            className={inputCls}
            type="number"
            value={Number.isNaN(scenario.threads as any) ? '' : scenario.threads}
            onChange={(e) => {
              const v = e.target.value;
              setScenario({ ...scenario, threads: v === '' ? 0 : (parseInt(v, 10) || 0) });
            }}
          />
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Buffer Policy</span>
            <span className="tooltip" data-tip="서버 큐 정책\n- unbounded: 무한\n- bounded_drop_newest: 최신 드롭\n- bounded_drop_oldest: 오래된 것 드롭">?</span>
          </div>
          <select className={inputCls} value={scenario.buffer} onChange={(e) => setScenario({ ...scenario, buffer: e.target.value as any })}>
            <option value="unbounded">unbounded</option>
            <option value="bounded_drop_newest">bounded_drop_newest</option>
            <option value="bounded_drop_oldest">bounded_drop_oldest</option>
          </select>
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Capacity</span>
            <span className="tooltip" data-tip="bounded 정책일 때 큐 크기(프레임 개수)">?</span>
          </div>
          <input
            className={inputCls}
            type="number"
            value={Number.isNaN(scenario.capacity as any) ? '' : scenario.capacity}
            onChange={(e) => {
              const v = e.target.value;
              setScenario({ ...scenario, capacity: v === '' ? 0 : (parseInt(v, 10) || 0) });
            }}
          />
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Win (sec)</span>
            <span className="tooltip" data-tip="슬라이딩 윈도우 길이(초) — 분석 구간">?</span>
          </div>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            value={Number.isNaN(scenario.win as any) ? '' : scenario.win}
            onChange={(e) => {
              const v = e.target.value;
              setScenario({ ...scenario, win: v === '' ? 0 : (parseFloat(v) || 0) });
            }}
          />
        </label>
        <label className="grid gap-1">
          <div className="flex items-center gap-1">
            <span className={labelCls}>Hop (sec)</span>
            <span className="tooltip" data-tip="윈도우 이동 간격(초) — 분할 주기">?</span>
          </div>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            value={Number.isNaN(scenario.hop as any) ? '' : scenario.hop}
            onChange={(e) => {
              const v = e.target.value;
              setScenario({ ...scenario, hop: v === '' ? 0 : (parseFloat(v) || 0) });
            }}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm" onClick={start} title={!file ? 'Select an audio file first' : ''}>Start Experiment</button>
        <button
          className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm"
          onClick={() => file && onStartBatch?.(file)}
          title={!file ? 'Select an audio file first' : 'Run 24 combos × 5 repeats'}
        >Auto Run 24×5</button>
        <button className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm" onClick={save}>Save Preset</button>
        <button className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm" onClick={load}>Load Preset</button>
      </div>
    </div>
  );
}

