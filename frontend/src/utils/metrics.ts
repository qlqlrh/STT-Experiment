export type MetricStats = {
  mean: number;
  p95: number;
};

export type KpiMetrics = {
  asl: MetricStats; // Added System Latency (s)
  aslPercent: MetricStats; // ASL% (%)
  rtf: MetricStats; // Real Time Factor
  ttft: { p95: number }; // Time To First Token (s)
};

export type ResultLevel = "PASS" | "WARN" | "FAIL";

export type KpiResult = {
  asl: ResultLevel;
  aslPercent: ResultLevel;
  rtf: ResultLevel;
  ttft: ResultLevel;
  overall: ResultLevel;
};

export const DESCRIPTIONS: Record<string, string> = {
  asl: "오디오 길이를 제외한 시스템 추가 지연 (E2E − duration)",
  aslPercent: "발화 길이에 대한 추가 지연 비율",
  rtf: "STT 처리 속도의 상대값 (1 미만이면 실시간보다 빠름)",
  ttft: "첫 결과가 나타날 때까지 걸린 시간",
};

function evaluateAsl(asl: MetricStats): ResultLevel {
  // PASS: mean ≤ 1.0s & P95 ≤ 2.0s
  if (asl.mean <= 1.0 && asl.p95 <= 2.0) return "PASS";
  // WARN: mean ≤ 2.0s or P95 ≤ 3.0s
  if (asl.mean <= 2.0 || asl.p95 <= 3.0) return "WARN";
  // FAIL: 그 이상
  return "FAIL";
}

function evaluateAslPercent(aslPercent: MetricStats): ResultLevel {
  // PASS: mean ≤ 20% & P95 ≤ 40%
  if (aslPercent.mean <= 20 && aslPercent.p95 <= 40) return "PASS";
  // WARN: mean ≤ 40% or P95 ≤ 60%
  if (aslPercent.mean <= 40 || aslPercent.p95 <= 60) return "WARN";
  // FAIL: 그 이상
  return "FAIL";
}

function evaluateRtf(rtf: MetricStats): ResultLevel {
  // PASS: mean ≤ 0.8 & P95 ≤ 1.0
  if (rtf.mean <= 0.8 && rtf.p95 <= 1.0) return "PASS";
  // WARN: mean ≤ 1.0 or P95 ≤ 1.2
  if (rtf.mean <= 1.0 || rtf.p95 <= 1.2) return "WARN";
  // FAIL: 그 이상
  return "FAIL";
}

function evaluateTtft(ttft: { p95: number }): ResultLevel {
  // PASS: P95 ≤ 1.0s
  if (ttft.p95 <= 1.0) return "PASS";
  // WARN: P95 ≤ 2.0s
  if (ttft.p95 <= 2.0) return "WARN";
  // FAIL: 그 이상
  return "FAIL";
}

export function evaluateKpi(metrics: KpiMetrics): KpiResult {
  const asl = evaluateAsl(metrics.asl);
  const aslPercent = evaluateAslPercent(metrics.aslPercent);
  const rtf = evaluateRtf(metrics.rtf);
  const ttft = evaluateTtft(metrics.ttft);

  const results: ResultLevel[] = [asl, aslPercent, rtf, ttft];
  const failCount = results.filter(r => r === "FAIL").length;
  const warnCount = results.filter(r => r === "WARN").length;

  let overall: ResultLevel;
  // 종합 판정 규칙:
  //  - 모든 지표 PASS → PASS
  //  - 단일 WARN 나머지 PASS → WARN
  //  - 2개 이상 WARN 또는 1개 이상 FAIL → FAIL
  if (failCount >= 1 || warnCount >= 2) {
    overall = "FAIL";
  } else if (warnCount === 1) {
    overall = "WARN";
  } else {
    overall = "PASS";
  }

  return { asl, aslPercent, rtf, ttft, overall };
}


