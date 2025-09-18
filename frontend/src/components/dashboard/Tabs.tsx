"use client";
import React from "react";

type TabsProps = {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
  children: React.ReactNode;
};

export default function Tabs({ tabs, active, onChange, children }: TabsProps) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="border-b px-4">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => onChange(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                active === t ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 overflow-auto min-h-0 flex-1">{children}</div>
    </div>
  );
}

