export type JobStage = 'ocr';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobResultSummary {
  regionsProcessed: number;
  filledCount: number;
  skippedCount: number;
}

export interface JobRecord {
  id: string;
  stage: JobStage;
  status: JobStatus;
  pageId: string;
  pageName: string;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  progress: number;
  message: string;
  error: string | null;
  result: JobResultSummary | null;
}
