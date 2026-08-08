"use client";

import type { TableColumn } from "../../engine/question-pack.types";

type Row = Record<string, string>;

interface EditableTableProps {
  columns: TableColumn[];
  minRows?: number;
  value: Row[] | undefined;
  onChange: (value: Row[]) => void;
}

function emptyRow(columns: TableColumn[]): Row {
  return Object.fromEntries(columns.map((c) => [c.key, ""]));
}

function inputType(columnType: TableColumn["type"]): string {
  if (columnType === "number" || columnType === "currency") return "number";
  if (columnType === "time") return "time";
  return "text";
}

export function EditableTable({ columns, minRows = 1, value, onChange }: EditableTableProps) {
  const rows = value && value.length > 0 ? value : Array.from({ length: minRows }, () => emptyRow(columns));

  function updateCell(rowIndex: number, key: string, cellValue: string) {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [key]: cellValue } : row));
    onChange(next);
  }

  function addRow() {
    onChange([...rows, emptyRow(columns)]);
  }

  function removeRow(rowIndex: number) {
    const next = rows.filter((_, i) => i !== rowIndex);
    onChange(next.length > 0 ? next : [emptyRow(columns)]);
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          {columns.map((column) => (
            <label key={column.key} className="flex flex-col gap-1">
              <span className="text-xs text-muted">
                {column.label}
                {column.type === "currency" && " (MXN)"}
              </span>
              <input
                type={inputType(column.type)}
                value={row[column.key] ?? ""}
                onChange={(e) => updateCell(rowIndex, column.key, e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground outline-none focus-visible:border-transparent"
              />
            </label>
          ))}
          {rows.length > minRows && (
            <button
              type="button"
              onClick={() => removeRow(rowIndex)}
              className="self-start text-xs text-danger"
            >
              Quitar
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="h-10 rounded-md border border-border text-sm text-secondary"
      >
        + Agregar
      </button>
    </div>
  );
}
