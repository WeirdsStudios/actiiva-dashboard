export type QuestionType =
  | "short_text"
  | "long_text"
  | "quick_options"
  | "multi_select"
  | "editable_table"
  | "file_upload"
  | "yes_no";

export type SensitivityLevel = "public" | "internal" | "confidential";

export type ResponseStatus =
  | "unanswered"
  | "draft"
  | "owner_confirmed"
  | "flagged_missing" // "Completar después"
  | "unknown"; // "No lo sé todavía"

export interface FileConstraint {
  accept: string[];
  maxSizeMb: number;
  maxFiles: number;
}

export interface QuestionCondition {
  dependsOn: string;
  operator: "equals" | "notEquals" | "includes" | "answered" | "notAnswered";
  value?: unknown;
}

export interface QuickOption {
  value: string;
  label: string;
}

export interface TableColumn {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "time";
}

export interface QuestionDefinition {
  id: string;
  sectionId: string;
  order: number;
  prompt: string;
  helpText?: string;
  type: QuestionType;
  required: boolean;
  allowSkip: boolean;
  allowUnknown: boolean;
  options?: QuickOption[]; // quick_options / multi_select
  fileConstraint?: FileConstraint;
  tableSchema?: { columns: TableColumn[]; minRows?: number };
  conditions?: QuestionCondition[];
  dataTarget: string;
  sensitivity: SensitivityLevel;
}

export interface QuestionSection {
  id: string;
  order: number;
  title: string;
  description?: string;
}

export interface QuestionPack {
  id: string;
  version: string;
  industry: string;
  sections: QuestionSection[];
  questions: QuestionDefinition[];
}

export interface AnswerState {
  value: unknown;
  status: ResponseStatus;
}

export type AnswersMap = Record<string, AnswerState>;
