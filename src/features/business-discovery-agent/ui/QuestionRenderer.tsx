"use client";

import type { QuestionDefinition } from "../engine/question-pack.types";
import { uploadDiscoveryAsset } from "../server/actions";
import { TextInput } from "./inputs/TextInput";
import { TextArea } from "./inputs/TextArea";
import { QuickOptions } from "./inputs/QuickOptions";
import { MultiSelect } from "./inputs/MultiSelect";
import { YesNo } from "./inputs/YesNo";
import { EditableTable } from "./inputs/EditableTable";
import { FileUpload, type UploadedFileRef } from "./inputs/FileUpload";

interface QuestionRendererProps {
  question: QuestionDefinition;
  sessionId: string;
  accessToken: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function QuestionRenderer({ question, sessionId, accessToken, value, onChange }: QuestionRendererProps) {
  switch (question.type) {
    case "short_text":
      return <TextInput value={(value as string) ?? ""} onChange={onChange} />;

    case "long_text":
      return <TextArea value={(value as string) ?? ""} onChange={onChange} />;

    case "quick_options":
      return (
        <QuickOptions
          options={question.options ?? []}
          value={value as string | undefined}
          onChange={onChange}
        />
      );

    case "multi_select":
      return (
        <MultiSelect
          options={question.options ?? []}
          value={value as string[] | undefined}
          onChange={onChange}
        />
      );

    case "yes_no":
      return <YesNo value={value as boolean | undefined} onChange={onChange} />;

    case "editable_table":
      return (
        <EditableTable
          columns={question.tableSchema?.columns ?? []}
          minRows={question.tableSchema?.minRows}
          value={value as Record<string, string>[] | undefined}
          onChange={onChange}
        />
      );

    case "file_upload":
      return (
        <FileUpload
          constraint={question.fileConstraint}
          value={value as UploadedFileRef[] | undefined}
          onChange={onChange}
          onUpload={(file) => {
            const formData = new FormData();
            formData.append("file", file);
            return uploadDiscoveryAsset(sessionId, accessToken, question.id, formData);
          }}
        />
      );

    default:
      return (
        <p className="text-sm text-muted">
          Tipo de pregunta &ldquo;{question.type}&rdquo; todavía no implementado.
        </p>
      );
  }
}
