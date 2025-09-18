"use client";
import React, { useCallback, useRef, useState } from "react";

type BufferPolicy = "UNBOUNDED" | "BOUNDED_DROP_NEWEST" | "BOUNDED_DROP_OLDEST";
type PaceMode = "realtime" | "fast";

type ServerEvent =
  | { type: "SVR_T3"; t3_ms: number }
  | { type: "SVR_T4_FINAL"; t4_ms: number; transcript: string };

type ExperimentParams = {
  segmentId: string;
  slidingWindowSec: number;
  hopSec: number;
  frameSize: number;
  threads: number;
  bufferPolicy: BufferPolicy;
  queueCapacity: number;
  languageCode: string;
  pace: PaceMode;
};

type Metrics = {
  T1?: number;
  T2?: number;
  T3?: number;
  T4?: number;
  T5?: number;
  e2e?: number;
  sttProcessing?: number; // T4 - T3
  transport?: number; // T3 - T2
  uiApply?: number; // T5 - T4
};

const WS_URL = process.env.NEXT_PUBLIC_STT_WS_URL as string;

async function decodeAndResampleToMono16k(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const audioCtx = new (AudioCtor as typeof AudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const channel = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mixed[i] += channel[i] / numChannels;
    }
  }

  const targetRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil((length * targetRate) / audioBuffer.sampleRate), targetRate);
  const buffer = offlineCtx.createBuffer(1, length, audioBuffer.sampleRate);
  buffer.copyToChannel(mixed, 0, 0);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

function floatToInt16PCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function chunkInt16(data: Int16Array, frameSize: number): Int16Array[] {
  const chunks: Int16Array[] = [];
  for (let i = 0; i < data.length; i += frameSize) {
    chunks.push(data.subarray(i, Math.min(i + frameSize, data.length)));
  }
  return chunks;
}

export default function SttExperiment() {
  const [file, setFile] = useState<File | null>(null);
  const [params, setParams] = useState<ExperimentParams>({
    segmentId: "seg-" + Math.random().toString(36).slice(2, 8),
    slidingWindowSec: 2.0,
    hopSec: 0.5,
    frameSize: 4096,
    threads: 1,
    bufferPolicy: "UNBOUNDED",
    queueCapacity: 0,
    languageCode: "ko-KR",
    pace: "realtime",
  });
  const [metrics, setMetrics] = useState<Metrics>({});
  const [transcript, setTranscript] = useState<string>("");
  const [running, setRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const t3Ref = useRef<number | undefined>(undefined);
  const t4Ref = useRef<number | undefined>(undefined);

  const handleServerMessage = useCallback((ev: MessageEvent) => {
    if (typeof ev.data !== "string") return;
    try {
      const msg = JSON.parse(ev.data) as ServerEvent;
      if (msg.type === "SVR_T3") {
        t3Ref.current = msg.t3_ms;
        setMetrics((m) => ({ ...m, T3: msg.t3_ms }));
      } else if (msg.type === "SVR_T4_FINAL") {
        t4Ref.current = msg.t4_ms;
        setTranscript(msg.transcript);
        setMetrics((m) => ({ ...m, T4: msg.t4_ms }));
        requestAnimationFrame(() => {
          const T5 = performance.now();
          setMetrics((m) => {
            const e2e = m.T1 !== undefined ? T5 - m.T1 : undefined;
            const sttProcessing = t3Ref.current !== undefined && t4Ref.current !== undefined ? t4Ref.current - t3Ref.current : undefined;
            const transport = m.T2 !== undefined && t3Ref.current !== undefined ? t3Ref.current - m.T2 : undefined;
            const uiApply = t4Ref.current !== undefined ? T5 - t4Ref.current : undefined;
            return { ...m, T5, e2e, sttProcessing, transport, uiApply };
          });
          setRunning(false);
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const startExperiment = useCallback(async () => {
    if (!file) return;
    if (!WS_URL) {
      alert("Missing NEXT_PUBLIC_STT_WS_URL");
      return;
    }
    setTranscript("");
    setMetrics({});
    setRunning(true);

    const mono16k = await decodeAndResampleToMono16k(file);
    const pcm16 = floatToInt16PCM(mono16k);
    const frames = chunkInt16(pcm16, params.frameSize);

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const T1 = performance.now();
    setMetrics((m) => ({ ...m, T1 }));

    ws.onopen = () => {
      const init = {
        type: "init",
        segmentId: params.segmentId,
        sampleRateHz: 16000,
        languageCode: params.languageCode,
        threads: params.threads,
        bufferPolicy: params.bufferPolicy,
        queueCapacity: params.queueCapacity,
        slidingWindowSec: params.slidingWindowSec,
        hopSec: params.hopSec,
        frameSize: params.frameSize,
        pace: params.pace,
      };
      ws.send(JSON.stringify(init));

      let firstSent = false;
      const sendFrame = (idx: number) => {
        if (idx >= frames.length) {
          ws.send(JSON.stringify({ type: "end" }));
          return;
        }
        const buf = frames[idx].buffer.slice(frames[idx].byteOffset, frames[idx].byteOffset + frames[idx].byteLength);
        ws.send(buf);
        if (!firstSent) {
          firstSent = true;
          const T2 = performance.now();
          setMetrics((m) => ({ ...m, T2 }));
        }
        if (params.pace === "realtime") {
          const frameMs = (params.frameSize / 16000) * 1000;
          setTimeout(() => sendFrame(idx + 1), frameMs);
        } else {
          // fast
          setTimeout(() => sendFrame(idx + 1), 0);
        }
      };
      sendFrame(0);
    };
    ws.onmessage = handleServerMessage;
    ws.onerror = () => {
      setRunning(false);
    };
    ws.onclose = () => {};
  }, [file, handleServerMessage, params]);

  const disabled = running;

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 16,
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
  };

  const buttonStyle: React.CSSProperties = {
    appearance: "none",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    background: disabled ? "#c7d2fe" : "#6366f1",
    color: "white",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 22, margin: 0 }}>STT Latency Experiment</h2>
          {running ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#22c55e", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#16a34a" }}>Running</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280" }}>Idle</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#374151" }}>
                <span>Audio File (mp3/wav)</span>
                <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={inputStyle} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(200px, 1fr))", gap: 10 }}>
                <label>
                  Segment ID
                  <input type="text" value={params.segmentId} onChange={(e) => setParams({ ...params, segmentId: e.target.value })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Language Code
                  <input type="text" value={params.languageCode} onChange={(e) => setParams({ ...params, languageCode: e.target.value })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Sliding Window (sec)
                  <input type="number" step="0.1" value={params.slidingWindowSec} onChange={(e) => setParams({ ...params, slidingWindowSec: parseFloat(e.target.value) })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Hop (sec)
                  <input type="number" step="0.1" value={params.hopSec} onChange={(e) => setParams({ ...params, hopSec: parseFloat(e.target.value) })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Frame Size (samples)
                  <input type="number" value={params.frameSize} onChange={(e) => setParams({ ...params, frameSize: parseInt(e.target.value, 10) })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Threads
                  <input type="number" value={params.threads} onChange={(e) => setParams({ ...params, threads: parseInt(e.target.value, 10) })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Buffer Policy
                  <select value={params.bufferPolicy} onChange={(e) => setParams({ ...params, bufferPolicy: e.target.value as BufferPolicy })} disabled={disabled} style={inputStyle}>
                    <option value="UNBOUNDED">unbounded</option>
                    <option value="BOUNDED_DROP_NEWEST">bounded_drop_newest</option>
                    <option value="BOUNDED_DROP_OLDEST">bounded_drop_oldest</option>
                  </select>
                </label>
                <label>
                  Queue Capacity
                  <input type="number" value={params.queueCapacity} onChange={(e) => setParams({ ...params, queueCapacity: parseInt(e.target.value, 10) })} disabled={disabled} style={inputStyle} />
                </label>
                <label>
                  Pace
                  <select value={params.pace} onChange={(e) => setParams({ ...params, pace: e.target.value as PaceMode })} disabled={disabled} style={inputStyle}>
                    <option value="realtime">realtime</option>
                    <option value="fast">fast</option>
                  </select>
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={startExperiment} disabled={disabled || !file} style={buttonStyle}>
                  {running ? "Running..." : "Start Experiment"}
                </button>
                {running && (
                  <div style={{ flex: 1, height: 8, background: "#eef2ff", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: "40%", height: "100%", background: "#6366f1", borderRadius: 999, animation: "pulse 1.2s ease-in-out infinite" }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Result</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#374151" }}>Segment: <strong>{params.segmentId}</strong></div>
              <div style={{ color: "#374151" }}>Transcript: <span>{transcript || ""}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                <div>T1: {metrics.T1?.toFixed(2)}</div>
                <div>T2: {metrics.T2?.toFixed(2)}</div>
                <div>T3: {metrics.T3}</div>
                <div>T4: {metrics.T4}</div>
                <div>T5: {metrics.T5?.toFixed(2)}</div>
                <div>E2E: {metrics.e2e !== undefined ? metrics.e2e.toFixed(2) : ""}</div>
                <div>STT: {metrics.sttProcessing !== undefined ? metrics.sttProcessing.toFixed(2) : ""}</div>
                <div>Transport: {metrics.transport !== undefined ? metrics.transport.toFixed(2) : ""}</div>
                <div>UI: {metrics.uiApply !== undefined ? metrics.uiApply.toFixed(2) : ""}</div>
              </div>
              <pre style={{ marginTop: 4, background: "#f6f8fa", padding: 8, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(params, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0% { transform: translateX(-50%); opacity: .6; }
            50% { transform: translateX(30%); opacity: 1; }
            100% { transform: translateX(120%); opacity: .6; }
          }
        `}</style>
      </div>
    </div>
  );
}


