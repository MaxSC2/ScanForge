export type DiagnosticScope =
  | 'ocr'
  | 'translation'
  | 'export'
  | 'recovery'
  | 'autosave'
  | 'project'
  | 'runtime';

export type DiagnosticLevel = 'info' | 'warning' | 'error';

export interface DiagnosticEntry {
  id: string;
  scope: DiagnosticScope;
  level: DiagnosticLevel;
  message: string;
  timestamp: number;
  count: number;
  detail?: string;
  projectId?: string;
  pageId?: string;
  regionId?: string;
  jobId?: string;
}

export interface DiagnosticInput {
  scope: DiagnosticScope;
  level: DiagnosticLevel;
  message: string;
  timestamp?: number;
  detail?: string;
  projectId?: string;
  pageId?: string;
  regionId?: string;
  jobId?: string;
}
