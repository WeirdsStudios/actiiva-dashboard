"use client";

import { useState, useTransition } from "react";
import type { FileConstraint } from "../../engine/question-pack.types";

export interface UploadedFileRef {
  filename: string;
  path: string;
}

type UploadResult = { ok: true; asset: UploadedFileRef } | { ok: false; error: string };

interface FileUploadProps {
  constraint: FileConstraint | undefined;
  value: UploadedFileRef[] | undefined;
  onUpload: (file: File) => Promise<UploadResult>;
  onChange: (value: UploadedFileRef[]) => void;
}

export function FileUpload({ constraint, value, onUpload, onChange }: FileUploadProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const files = value ?? [];

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const file = fileList[0];

    if (constraint?.maxSizeMb && file.size > constraint.maxSizeMb * 1024 * 1024) {
      setError(`El archivo pesa más de ${constraint.maxSizeMb}MB.`);
      return;
    }

    startTransition(async () => {
      const result = await onUpload(file);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const maxFiles = constraint?.maxFiles ?? 1;
      onChange([...files, result.asset].slice(-maxFiles));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center text-sm text-secondary">
        {isPending ? "Subiendo..." : "Toca para elegir un archivo"}
        <input
          type="file"
          accept={constraint?.accept?.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.path} className="text-sm text-foreground">
              {f.filename}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
