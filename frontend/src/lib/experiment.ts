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

  const seg = {
    id: params.segmentId,
    t1c: performance.now(), // T1c: 세그먼트 시작
    t2c: undefined as number | undefined, // T2c: 첫 프레임 전송 직후
    t4f_c: undefined as number | undefined, // T4f_c: final 결과 수신 시각
    firstResult_c: undefined as number | undefined, // 첫 결과 시각 (final 기준)
    t5c: undefined as number | undefined, // T5c: UI 반영 완료 직후
    txPipe_ms: undefined as number | undefined, // 서버 델타 (S3-S2)
    sttProc_ms: undefined as number | undefined, // 서버 델타 (S4f-S3)
    rtf: undefined as number | undefined, // 서버 제공 RTF (선택)
    completed: false as boolean, // 완료 가드
  };
  cb.onSegmentUpdate({ id: seg.id, t1: seg.t1c, t1Epoch: Date.now() });

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
        // ws.send() 호출이 성공적으로 반환된 직후에 T2c 기록
        seg.t2c = performance.now(); // T2c: 첫 프레임 전송 직후
        cb.onSegmentUpdate({ id: seg.id, t1: seg.t1c!, t2: seg.t2c, t2Epoch: Date.now() });
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
        // 서버 델타만 반영 (절대시각으로 재구성 금지)
        seg.txPipe_ms = typeof msg.txPipe_ms === 'number' ? msg.txPipe_ms : undefined;
        cb.onSegmentUpdate({ id: seg.id, t1: seg.t1c!, tx: seg.txPipe_ms as any });
      } else if (msg.type === 'SVR_T4_FINAL') {
        // 서버에서 STT 처리 지연을 델타로 받음
        seg.sttProc_ms = typeof msg.sttProc_ms === 'number' ? msg.sttProc_ms : undefined;
        seg.rtf = typeof msg.rtf === 'number' ? msg.rtf : undefined;
        seg.t4f_c = performance.now(); // T4f_c: final 결과 수신 시각
        if (!seg.firstResult_c) seg.firstResult_c = seg.t4f_c;
        
        // Update immediately with T4(final) and STT
        cb.onSegmentUpdate({
          id: seg.id,
          t1: seg.t1c!,
          // t4는 final 수신 시각만 사용
          t4: seg.t4f_c,
          transcript: msg.transcript,
          t4Epoch: Date.now(),
          stt: seg.sttProc_ms as any,
          dropRate: typeof msg.drop_rate === 'number' ? msg.drop_rate : undefined,
        });
        
        // T4 수신 즉시 동기적으로 T5를 근사 계산하여 Run 저장을 트리거
        if (!(seg as any).completed) {
          seg.t5c = performance.now();
          const e2e = seg.t1c && seg.t5c ? seg.t5c - seg.t1c : undefined;
          const ui = seg.t4f_c && seg.t5c ? seg.t5c - seg.t4f_c : undefined;
          (seg as any).completed = true;
          cb.onSegmentUpdate({
            id: seg.id,
            t1: seg.t1c!,
            t4: seg.t4f_c,
            t5: seg.t5c,
            e2e,
            ui,
            t5Epoch: Date.now(),
            dropRate: typeof msg.drop_rate === 'number' ? msg.drop_rate : undefined,
          });
          cb.onCompleted();
        }
      }
    } catch {}
  };

  ws.onerror = (e) => cb.onError(e);
}

