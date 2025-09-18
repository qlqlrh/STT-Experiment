export type BufferPolicy = "unbounded" | "bounded_drop_newest" | "bounded_drop_oldest";
export type Pace = "realtime" | "fast";

export type Scenario = {
  frame: number;
  pace: Pace;
  threads: number;
  buffer: BufferPolicy;
  capacity: number;
  win: number;
  hop: number;
  lang: string;
  filename: string;
};

export type Segment = {
  id: string;
  t1: number; t2: number; t3: number; t4: number; t5: number;
  e2e: number; stt: number; tx: number; ui: number;
  transcript?: string;
  droppedFrames?: number;
  // display-only epoch timestamps (ms, KST-format for UI)
  t1Epoch?: number; t2Epoch?: number; t3Epoch?: number; t4Epoch?: number; t5Epoch?: number;
};

export type Metrics = {
  n: number;
  e2e: { mean: number; p95: number; std?: number };
  stt: { mean: number; p95: number };
  tx:  { mean: number; p95: number };
  ui:  { mean: number; p95: number };
  dropRate?: number;
  maxQueueDepthP95?: number;
};

export type Run = {
  id: string;
  startedAt: number;
  scenario: Scenario;
  metrics: Metrics;
  status: "pass" | "warn" | "fail";
  segments: Segment[];
};

