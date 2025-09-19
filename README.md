# STT Experiment Monorepo

This repo contains a Next.js dashboard and a Spring Boot backend for real-time STT latency experiments.

## Structure
- frontend/: Next.js (React+TS) app
- backend/: Spring Boot (Java 21) app

## Prerequisites
- Node.js 18+
- Java 21
- Google Cloud STT credentials file: `backend/src/main/resources/stt-credentials.json`

## Quickstart

Backend:
```bash
cd backend
./gradlew bootRun
```

Frontend:
```bash
cd frontend
echo "NEXT_PUBLIC_STT_WS_URL=ws://localhost:8080/ws/audio" > .env.local
npm install
npm run dev
# open http://localhost:3000
```

---

## Experiment Dashboard

### Scenario Parameters (left panel)
- Language (`lang`), Pace (`realtime` | `fast`)
- Frame size (`frame`, samples)
- Sliding window / hop (`win`, `hop`, sec)
- Threads (`threads`)
- Buffer policy (`unbounded` | `bounded_drop_newest` | `bounded_drop_oldest`) and capacity (`capacity`)
- Audio file upload (mp3/wav)

### T1~T5 Timeline (what each timestamp means)
- T1 — Segment capture start (client, performance.now monotonic)
- T2 — First PCM frame sent (client)
- T3 — First audio pushed to STT (server)
- T4 — Final transcript received from STT (server)
- T5 — UI render applied (client)

Display-only KST epoch is shown in Live (Asia/Seoul). It uses client `Date.now()` and backend `server_epoch_ms` added to `SVR_T3`/`SVR_T4_FINAL`.

### Metrics
- E2E (ms) = T5 − T1  (end-to-end, user-perceived latency)
- STT (ms) = T4 − T3  (engine/service processing time; informational)
- Tx (ms) = T3_client_arrival − T2  (transport/queuing on client; informational)
- UI (ms) = T5 − T4_client_arrival  (render/apply time; informational)
- D (ms) = input audio duration

- ASL (Added System Latency, seconds):
  - ASL = max(0, E2E − D) / 1000
  - Rationale: subtracts inherent speaking time to isolate system-induced overhead; clamps negatives to 0.

- ASL% (Added System Latency Percentage, %):
  - ASL% = (max(0, E2E − D) / max(1, D)) × 100
  - Rationale: normalizes by utterance length to compare across varying durations.

Aggregation: per scenario, compute mean and p95 over M repeated trials.

All metrics are computed as monotonic differences within the same clock domain. Absolute clocks (KST) are for display only.

### Why ASL and ASL%?
- Variable-length robustness: Different audio files (and user utterances) have different durations D. Using E2E alone unfairly penalizes longer inputs. Subtracting D isolates system overhead.
- Fair cross-scenario comparison: ASL% scales ASL by D, enabling apples-to-apples comparison across files, languages, and pacing modes.
- Real-time suitability: ASL% ≤ 100% implies processing keeps up with speaking time (RTF ≤ 1) on average.
- Stability and sanity: Negative (E2E − D) from timestamp jitter is clamped to 0 to avoid spurious gains.

### KPI (code-defined)
- ASL
  - PASS: mean ≤ 1.0 s AND p95 ≤ 2.0 s
  - WARN: mean ≤ 2.0 s OR p95 ≤ 3.0 s
  - FAIL: otherwise
- ASL%
  - PASS: mean ≤ 20% AND p95 ≤ 40%
  - WARN: mean ≤ 40% OR p95 ≤ 60%
  - FAIL: otherwise
- Overall
  - PASS if both metrics PASS
  - WARN if exactly one is WARN (and none FAIL)
  - FAIL otherwise

### Tabs (right side)
- Live: current segment timeline (T1~T5), live metrics, recent E2E sparkline
- Summary: scenario badge, KPI cards (mean/P95/std/n), distribution summary
- Distributions: E2E CDF with 2.5s guide; histograms for STT/Tx/UI; toggle recent runs
- Runs: table of past runs (CSV export)
- Logs: segment cards with T1~T5/derived metrics/transcript preview and filters

### Data Model (frontend)
Types are in `frontend/src/types/experiment.ts`.

```ts
export type BufferPolicy = "unbounded" | "bounded_drop_newest" | "bounded_drop_oldest";
export type Pace = "realtime" | "fast";

export type Scenario = {
  frame: number; pace: Pace; threads: number; buffer: BufferPolicy; capacity: number;
  win: number; hop: number; lang: string; filename: string;
};

export type Segment = {
  id: string; t1: number; t2: number; t3: number; t4: number; t5: number;
  e2e: number; stt: number; tx: number; ui: number; transcript?: string;
  t1Epoch?: number; t2Epoch?: number; t3Epoch?: number; t4Epoch?: number; t5Epoch?: number;
};

export type Metrics = {
  n: number;
  e2e: { mean: number; p95: number; std?: number };
  stt: { mean: number; p95: number };
  tx:  { mean: number; p95: number };
  ui:  { mean: number; p95: number };
  dropRate?: number; maxQueueDepthP95?: number;
};

export type Run = {
  id: string; startedAt: number; scenario: Scenario; metrics: Metrics;
  status: "pass" | "warn" | "fail"; segments: Segment[];
};
```

### Backend Notes
- `application.yml` includes `app.stt.credentials: classpath:stt-credentials.json`.
- WebSocket endpoint: `ws://localhost:8080/ws/audio`.
- Server emits `SVR_T3` and `SVR_T4_FINAL` with monotonic ms (`t3_ms`/`t4_ms`) and `server_epoch_ms` (for display/KST).

### Troubleshooting
- If frontend shows missing metrics, confirm backend is running and env `NEXT_PUBLIC_STT_WS_URL` is set.
- IDE cannot resolve Spring/Google imports: open `backend` as Gradle project and run `./gradlew --refresh-dependencies clean build -x test`.
