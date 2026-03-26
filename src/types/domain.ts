export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface PageRecord {
  id: string;
  projectId: string;
  order: number;
  imagePath: string;
  width: number;
  height: number;
}

export type RegionRecordStatus = 'idle' | 'ocr_done' | 'translated';

export interface RegionRecord {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sourceText: string;
  translatedText: string;
  status: RegionRecordStatus;
  locked: boolean;
  visible: boolean;
  ocrConfidence?: number;
}

export type JobType = 'OCR' | 'TRANSLATE';
export type JobQueueStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobEntity {
  id: string;
  type: JobType;
  status: JobQueueStatus;
  projectId: string;
  pageId?: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}
