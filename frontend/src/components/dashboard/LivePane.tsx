"use client";
import React from "react";
import { Segment } from "@/types/experiment";
import { TIMESTAMP_DESCRIPTIONS, METRIC_DESCRIPTIONS, SHORT_TIPS } from "@/constants/descriptions";
import { DESCRIPTIONS, type KpiMetrics, type KpiResult } from "@/utils/metrics";

type Props = { current: Segment | null; recent: Segment[]; kpiMetrics?: KpiMetrics; kpiResult?: KpiResult };

export default function LivePane({ current, recent, kpiMetrics, kpiResult }: Props) {
  const progress = current ? Math.min(100, Math.max(0, ((current.t2 - current.t1) / Math.max(1, current.t5 - current.t1)) * 100)) : 0;
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Current Segment</div>
          <div className="text-xs text-gray-500">{current?.id ?? "—"}</div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 tabular text-sm">
          <Metric label="T1" value={current?.t1} raw />
          <Metric label="T2" value={current?.t2} raw />
          <Metric label="T3" value={current?.t3} raw />
          <Metric label="T4" value={current?.t4} raw />
          <Metric label="T5" value={current?.t5} raw />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {formatKstRow(current)}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 tabular text-sm">
          <Metric label="E2E" value={current?.e2e} />
          <Metric label="STT" value={current?.stt} />
          <Metric label="Tx" value={current?.tx} />
          <Metric label="UI" value={current?.ui} />
        </div>
        <div className="mt-3 rounded-md bg-indigo-50 border border-indigo-100 p-3 text-[13px] leading-5 text-indigo-900">
          <div className="font-medium mb-1">지표 해설</div>
          <p>이 실험은 오디오를 조각내 WebSocket으로 전송하고 서버 STT 처리 후 결과를 받는 여정을 측정합니다.</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {(["T1","T2","T3","T4","T5"] as const).map((k) => (
              <li key={k}><b>{TIMESTAMP_DESCRIPTIONS[k].title}</b> — {TIMESTAMP_DESCRIPTIONS[k].desc}</li>
            ))}
          </ul>
          <p className="mt-2">
            핵심 지표는 <b>{METRIC_DESCRIPTIONS.e2e.title}</b>({METRIC_DESCRIPTIONS.e2e.formula}), <b>{METRIC_DESCRIPTIONS.sttProc.title}</b>({METRIC_DESCRIPTIONS.sttProc.formula}), <b>{METRIC_DESCRIPTIONS.txPipe.title}</b>({METRIC_DESCRIPTIONS.txPipe.formula}), <b>{METRIC_DESCRIPTIONS.uiApply.title}</b>({METRIC_DESCRIPTIONS.uiApply.formula})로 계산됩니다.
          </p>
        </div>
        {current?.transcript && (
          <div className="mt-3 text-sm text-gray-700 line-clamp-2">{current.transcript}</div>
        )}
      </div>
      {kpiMetrics && kpiResult && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">KPI 종합 결과</div>
            <span className={`px-2 py-0.5 rounded text-xs ${kpiResult.overall === 'PASS' ? 'bg-green-100 text-green-700' : kpiResult.overall === 'WARN' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{kpiResult.overall}</span>
          </div>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <LiveMetricBadge title="ASL" desc={DESCRIPTIONS.asl} level={kpiResult.asl} main={`${kpiMetrics.asl.mean.toFixed(2)}s`} />
            <LiveMetricBadge title="ASL%" desc={DESCRIPTIONS.aslPercent} level={kpiResult.aslPercent} main={`${kpiMetrics.aslPercent.mean.toFixed(1)}%`} />
            <LiveMetricBadge title="RTF" desc={DESCRIPTIONS.rtf} level={kpiResult.rtf} main={`${kpiMetrics.rtf.mean.toFixed(2)}`} />
            <LiveMetricBadge title="TTFT" desc={DESCRIPTIONS.ttft} level={kpiResult.ttft} main={`${kpiMetrics.ttft.p95.toFixed(2)}s`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, raw }: { label: string; value?: number; raw?: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value !== undefined ? (raw ? Math.round(value) : `${value.toFixed(2)} ms`) : "—"}</div>
    </div>
  );
}

function formatKstRow(current: Segment | null) {
  if (!current) return null;
  const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', timeStyle: 'medium' });
  const t = (e?: number) => (e ? fmt.format(new Date(e)) : '—');
  return (
    <div className="grid grid-cols-5 gap-2">
      <div>{t(current.t1Epoch)}</div>
      <div>{t(current.t2Epoch)}</div>
      <div>{t(current.t3Epoch)}</div>
      <div>{t(current.t4Epoch)}</div>
      <div>{t(current.t5Epoch)}</div>
    </div>
  );
}

function LiveMetricBadge({ title, desc, level, main }: { title: string; desc: string; level: 'PASS' | 'WARN' | 'FAIL'; main: string }) {
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

