"use client";

import type { QuickOption } from "../../engine/question-pack.types";

interface QuickOptionsProps {
  options: QuickOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}

export function QuickOptions({ options, value, onChange }: QuickOptionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-md border px-4 py-2 text-left text-base transition-colors ${
              selected
                ? "border-primary bg-signal-soft text-foreground"
                : "border-border bg-surface text-foreground hover:border-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
