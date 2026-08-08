"use client";

import type { QuickOption } from "../../engine/question-pack.types";

interface MultiSelectProps {
  options: QuickOption[];
  value: string[] | undefined;
  onChange: (value: string[]) => void;
}

export function MultiSelect({ options, value, onChange }: MultiSelectProps) {
  const selectedValues = value ?? [];

  function toggle(optionValue: string) {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter((v) => v !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            className={`flex min-h-11 items-center gap-3 rounded-md border px-4 py-2 text-left text-base transition-colors ${
              selected
                ? "border-primary bg-signal-soft text-foreground"
                : "border-border bg-surface text-foreground hover:border-primary"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                selected ? "border-primary bg-primary text-white" : "border-border"
              }`}
            >
              {selected && (
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
                  <path
                    d="M3 8.5L6.5 12L13 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
