interface ProgressBarProps {
  percent: number;
  label: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
