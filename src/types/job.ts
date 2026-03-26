export type JobStage = 'ocr' | 'translate';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobResultSummary {
  provider: string;
  regionsProcessed: number;
  appliedCount: number;
  skippedCount: number;
}

export interface JobRecord {
  id: string;
  stage: JobStage;
  status: JobStatus;
  pageId: string;
  pageName: string;
  regionIds?: string[];
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  progress: number;
  message: string;
  error: string | null;
  result: JobResultSummary | null;
}
