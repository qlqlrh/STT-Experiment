export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.reduce((a, b) => a + b, 0);
  return s / values.length;
}

export function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx];
}

export function std(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const v = mean(values.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export function cdf(values: number[]): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.map((x, i) => ({ x, y: ((i + 1) / sorted.length) * 100 }));
}

