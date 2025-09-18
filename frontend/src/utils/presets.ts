import { Scenario } from "@/types/experiment";

const KEY = "stt_presets_v1";

export function savePreset(name: string, scenario: Scenario) {
  const all = loadAll();
  all[name] = scenario;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function loadPreset(name: string): Scenario | null {
  const all = loadAll();
  return all[name] ?? null;
}

export function listPresets(): string[] {
  return Object.keys(loadAll());
}

function loadAll(): Record<string, Scenario> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, Scenario>;
  } catch {
    return {};
  }
}

