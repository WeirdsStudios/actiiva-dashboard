"use client";

interface YesNoProps {
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

export function YesNo({ value, onChange }: YesNoProps) {
  return (
    <div className="flex gap-3">
      {[
        { label: "Sí", val: true },
        { label: "No", val: false },
      ].map((option) => {
        const selected = value === option.val;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.val)}
            className={`h-11 flex-1 rounded-md border text-base transition-colors ${
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
