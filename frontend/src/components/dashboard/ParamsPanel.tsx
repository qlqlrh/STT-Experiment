"use client";
import React, { useMemo, useState } from "react";
import { Scenario } from "@/types/experiment";
import { listPresets, loadPreset, savePreset } from "@/utils/presets";

type Props = {
  defaultScenario?: Partial<Scenario>;
  onStart: (s: Scenario, file: File) => void;
  onSavePreset?: (name: string, s: Scenario) => void;
  onLoadPreset?: (name: string, s: Scenario) => void;
};

export default function ParamsPanel({ defaultScenario, onStart, onSavePreset, onLoadPreset }: Props) {
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

  const inputCls = "px-2 py-1 border rounded-md text-sm";
  const labelCls = "text-xs text-gray-600";

  return (
    <div className="grid gap-3">
      <div>
        <div className={labelCls}>Audio File</div>
        <input className={inputCls} type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className={labelCls}>Language</span>
          <input className={inputCls} value={scenario.lang} onChange={(e) => setScenario({ ...scenario, lang: e.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Pace</span>
          <select className={inputCls} value={scenario.pace} onChange={(e) => setScenario({ ...scenario, pace: e.target.value as any })}>
            <option value="realtime">realtime</option>
            <option value="fast">fast</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Frame</span>
          <input className={inputCls} type="number" value={scenario.frame} onChange={(e) => setScenario({ ...scenario, frame: parseInt(e.target.value, 10) })} />
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Threads</span>
          <input className={inputCls} type="number" value={scenario.threads} onChange={(e) => setScenario({ ...scenario, threads: parseInt(e.target.value, 10) })} />
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Buffer Policy</span>
          <select className={inputCls} value={scenario.buffer} onChange={(e) => setScenario({ ...scenario, buffer: e.target.value as any })}>
            <option value="unbounded">unbounded</option>
            <option value="bounded_drop_newest">bounded_drop_newest</option>
            <option value="bounded_drop_oldest">bounded_drop_oldest</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Capacity</span>
          <input className={inputCls} type="number" value={scenario.capacity} onChange={(e) => setScenario({ ...scenario, capacity: parseInt(e.target.value, 10) })} />
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Win (sec)</span>
          <input className={inputCls} type="number" step="0.1" value={scenario.win} onChange={(e) => setScenario({ ...scenario, win: parseFloat(e.target.value) })} />
        </label>
        <label className="grid gap-1">
          <span className={labelCls}>Hop (sec)</span>
          <input className={inputCls} type="number" step="0.1" value={scenario.hop} onChange={(e) => setScenario({ ...scenario, hop: parseFloat(e.target.value) })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm" onClick={start} title={!file ? 'Select an audio file first' : ''}>Start Experiment</button>
        <button className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm" onClick={save}>Save Preset</button>
        <button className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm" onClick={load}>Load Preset</button>
      </div>
    </div>
  );
}

