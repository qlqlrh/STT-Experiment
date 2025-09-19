export type MetricStats = {
  mean: number;
  p95: number;
};

export type KpiMetrics = {
  asl: MetricStats; // Added System Latency (s)
  aslPercent: MetricStats; // ASL% (%)
};

export type ResultLevel = "PASS" | "WARN" | "FAIL";

export type KpiResult = {
  asl: ResultLevel;
  aslPercent: ResultLevel;
  overall: ResultLevel;
};

export const DESCRIPTIONS: Record<string, string> = {
  asl: "오디오 길이를 제외한 시스템 추가 지연 (E2E − duration)",
  aslPercent: "발화 길이에 대한 추가 지연 비율",
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

export function evaluateKpi(metrics: KpiMetrics): KpiResult {
  const asl = evaluateAsl(metrics.asl);
  const aslPercent = evaluateAslPercent(metrics.aslPercent);
  const results: ResultLevel[] = [asl, aslPercent];
  const failCount = results.filter(r => r === "FAIL").length;
  const warnCount = results.filter(r => r === "WARN").length;

  let overall: ResultLevel;
  // 종합 판정 규칙(ASL/ASL%만 반영):
  //  - 두 지표 모두 PASS → PASS
  //  - 하나만 WARN(FAIL 없음) → WARN
  //  - 그 외(FAIL ≥1 또는 WARN ≥2) → FAIL
  if (failCount >= 1 || warnCount >= 2) {
    overall = "FAIL";
  } else if (warnCount === 1) {
    overall = "WARN";
  } else {
    overall = "PASS";
  }

  return { asl, aslPercent, overall };
}


