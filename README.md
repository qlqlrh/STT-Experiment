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

### Metrics (ms)
- E2E = T5 − T1  (end-to-end user-perceived latency)
- STT = T4 − T3  (engine/service processing time)
- Tx = T3_client_arrival − T2  (transport/queuing on client)
- UI = T5 − T4_client_arrival  (render/apply time)

All metrics are computed as monotonic differences within the same clock domain. Absolute clocks (KST) are for display only.

### KPI (defaults)
- PASS when mean(E2E) ≤ 1500 ms and P95(E2E) ≤ 2500 ms
- WARN when within ~20% of thresholds; otherwise FAIL

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
