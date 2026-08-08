"use client";

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextArea({ value, onChange }: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={5}
      className="w-full resize-none rounded-md border border-border bg-surface p-4 text-base text-foreground outline-none focus-visible:border-transparent"
      autoFocus
    />
  );
}
