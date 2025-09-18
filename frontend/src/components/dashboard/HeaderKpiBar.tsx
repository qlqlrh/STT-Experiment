"use client";
import React from "react";
import { Scenario } from "@/types/experiment";

type Props = {
  scenario: Scenario | null;
  kpiStatus: "pass" | "warn" | "fail";
  kpiText: string;
};

export default function HeaderKpiBar({ scenario, kpiStatus, kpiText }: Props) {
  const badgeColor = kpiStatus === "pass" ? "bg-green-100 text-green-700" : kpiStatus === "warn" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Scenario</span>
        {scenario ? (
          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
            frame={scenario.frame} | pace={scenario.pace} | threads={scenario.threads} | buffer={scenario.buffer}({scenario.capacity}) | win={scenario.win}/hop={scenario.hop} | lang={scenario.lang}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </div>
      <div className={`px-2 py-1 rounded text-sm font-medium ${badgeColor}`}>{kpiText}</div>
    </div>
  );
}

