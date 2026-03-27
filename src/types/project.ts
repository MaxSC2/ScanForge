export interface ProjectMeta {
  localProjectId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type StitchDirection = 'vertical' | 'horizontal';
export type StitchAlign = 'start' | 'center' | 'end';
export type StitchScaleMode = 'original' | 'normalize-cross-axis';

export interface StitchOptions {
  direction: StitchDirection;
  gap: number;
  background: string;
  align: StitchAlign;
  scaleMode: StitchScaleMode;
  /** If null, use the largest cross-axis size among selected pages */
  crossAxisSize: number | null;
  /** Allow scaling up smaller pages when normalizing cross-axis */
  allowUpscale: boolean;
  /** Immediately export stitched output after it is created */
  exportAfterStitch: boolean;
}

export interface ProjectFilePage {
  id: string;
  fileName: string;
  imageDataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  regions: import('./region').Region[];
}

export interface ProjectFile {
  version: 1;
  meta: ProjectMeta;
  pages: ProjectFilePage[];
  activePageId: string | null;
}

export interface LocalProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  lastOpenedAt: number | null;
}

export interface LocalProjectSaveResult {
  project: ProjectFile;
  summary: LocalProjectSummary;
}

export type LocalProjectLoadSource = 'domain' | 'snapshot';

export interface LocalProjectLoadResult {
  project: ProjectFile;
  source: LocalProjectLoadSource;
  warning?: string | null;
}
