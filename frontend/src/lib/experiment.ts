export type StartCallbacks = {
  onSegmentUpdate: (seg: {
    id: string;
    t1: number;
    t2?: number; t3?: number; t4?: number; t5?: number;
    e2e?: number; stt?: number; tx?: number; ui?: number;
    transcript?: string;
    // Optional epoch timestamps for UI display
    t1Epoch?: number; t2Epoch?: number; t3Epoch?: number; t4Epoch?: number; t5Epoch?: number;
    // Optional server-reported drop rate (0..1)
    dropRate?: number;
  }) => void;
  onCompleted: () => void;
  onError: (err: unknown) => void;
};

const WS_URL = process.env.NEXT_PUBLIC_STT_WS_URL as string;

export async function decodeAndResampleToMono16k(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtor();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const channel = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mixed[i] += channel[i] / numChannels;
  }

  const targetRate = 16000;
  const OfflineCtor = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtor(1, Math.ceil((length * targetRate) / audioBuffer.sampleRate), targetRate);
  const buffer = offlineCtx.createBuffer(1, length, audioBuffer.sampleRate);
  buffer.copyToChannel(mixed, 0, 0);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

export function floatToInt16PCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function chunkInt16(data: Int16Array, frameSize: number): Int16Array[] {
  const chunks: Int16Array[] = [];
  for (let i = 0; i < data.length; i += frameSize) {
    chunks.push(data.subarray(i, Math.min(i + frameSize, data.length)));
  }
  return chunks;
}

export function toBackendBufferPolicy(policy: string): string {
  if (policy === 'unbounded') return 'UNBOUNDED';
  if (policy === 'bounded_drop_newest') return 'BOUNDED_DROP_NEWEST';
  if (policy === 'bounded_drop_oldest') return 'BOUNDED_DROP_OLDEST';
  return 'UNBOUNDED';
}

export async function runExperiment(
  params: {
    segmentId: string;
    frame: number;
    threads: number;
    buffer: string;
    capacity: number;
    win: number;
    hop: number;
    lang: string;
    pace: 'realtime' | 'fast';
  },
  file: File,
  cb: StartCallbacks
) {
  if (!WS_URL) throw new Error('Missing NEXT_PUBLIC_STT_WS_URL');

  const mono16k = await decodeAndResampleToMono16k(file);
  const pcm16 = floatToInt16PCM(mono16k);
  const frames = chunkInt16(pcm16, params.frame);

  const ws = new WebSocket(WS_URL);
  ws.binaryType = 'arraybuffer';

  const seg = { id: params.segmentId, t1: performance.now(), t2: undefined as number|undefined, t3: undefined as number|undefined, t4: undefined as number|undefined, t5: undefined as number|undefined };
  cb.onSegmentUpdate({ id: seg.id, t1: seg.t1, t1Epoch: Date.now() });

  let t4ClientArrival: number | undefined;
  ws.onopen = () => {
    const init = {
      type: 'init',
      segmentId: params.segmentId,
      sampleRateHz: 16000,
      languageCode: params.lang,
      threads: params.threads,
      bufferPolicy: toBackendBufferPolicy(params.buffer),
      queueCapacity: params.capacity,
      slidingWindowSec: params.win,
      hopSec: params.hop,
      frameSize: params.frame,
      pace: params.pace,
    };
    ws.send(JSON.stringify(init));

    let firstSent = false;
    const sendFrame = (idx: number) => {
      if (idx >= frames.length) {
        // Signal end of audio to server; do not set T5 here (T5 is UI apply time after final transcript).
        ws.send(JSON.stringify({ type: 'end' }));
        return;
      }
      const buf = frames[idx].buffer.slice(frames[idx].byteOffset, frames[idx].byteOffset + frames[idx].byteLength);
      ws.send(buf);
      if (!firstSent) {
        firstSent = true;
        seg.t2 = performance.now();
        cb.onSegmentUpdate({ id: seg.id, t1: seg.t1!, t2: seg.t2, t2Epoch: Date.now() });
      }
      if (params.pace === 'realtime') {
        const frameMs = (params.frame / 16000) * 1000;
        setTimeout(() => sendFrame(idx + 1), frameMs);
      } else {
        setTimeout(() => sendFrame(idx + 1), 0);
      }
    };
    sendFrame(0);
  };

  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return;
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'SVR_T3') {
        seg.t3 = msg.t3_ms;
        const t3Client = performance.now();
        const tx = seg.t2 ? t3Client - seg.t2 : undefined;
        cb.onSegmentUpdate({ id: seg.id, t1: seg.t1!, t3: seg.t3, tx, t3Epoch: msg.server_epoch_ms ?? Date.now() });
      } else if (msg.type === 'SVR_T4_FINAL') {
        seg.t4 = msg.t4_ms;
        t4ClientArrival = performance.now();
        const stt = seg.t3 && seg.t4 ? seg.t4 - seg.t3 : undefined;
        // Update immediately with T4 and STT
        cb.onSegmentUpdate({ id: seg.id, t1: seg.t1!, t4: seg.t4, transcript: msg.transcript, t4Epoch: msg.server_epoch_ms ?? Date.now(), stt, dropRate: typeof msg.drop_rate === 'number' ? msg.drop_rate : undefined });
        // After the UI applies the transcript, capture T5 and compute E2E/UI
        requestAnimationFrame(() => {
          seg.t5 = performance.now();
          const e2e = seg.t1 && seg.t5 ? seg.t5 - seg.t1 : undefined;
          const ui = t4ClientArrival && seg.t5 ? seg.t5 - t4ClientArrival : undefined;
          cb.onSegmentUpdate({ id: seg.id, t1: seg.t1!, t5: seg.t5, e2e, ui, t5Epoch: Date.now(), dropRate: typeof msg.drop_rate === 'number' ? msg.drop_rate : undefined });
          cb.onCompleted();
        });
      }
    } catch {}
  };

  ws.onerror = (e) => cb.onError(e);
}

