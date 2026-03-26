export type { Region, RegionKind, RegionStatus } from './region';
export { REGION_KIND_OPTIONS, getRegionColor, normalizeRegion } from './region';
export type { Page } from './page';
export type {
  JobRecord,
  JobResultSummary,
  JobStage,
  JobStatus,
} from './job';
export type {
  OcrPagePayload,
  OcrPageResult,
  OcrRegionInput,
  OcrRegionResult,
} from './ocr';
export type {
  ProjectMeta,
  StitchOptions,
  StitchAlign,
  StitchDirection,
  StitchScaleMode,
  ProjectFile,
  LocalProjectSummary,
  LocalProjectSaveResult,
} from './project';
export type {
  JobEntity,
  JobQueueStatus,
  JobType,
  PageRecord,
  ProjectRecord,
  RegionRecord,
  RegionRecordStatus,
} from './domain';
