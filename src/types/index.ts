export type {
  Region,
  RegionKind,
  RegionStatus,
  RegionOrientation,
  RegionOcrStatus,
  RegionTranslationStatus,
} from './region';
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
  OcrEngineId,
  ProjectSettings,
  ProjectSourceLanguage,
  ProjectTargetLanguage,
  TranslationProviderId,
} from './projectSettings';
export { DEFAULT_PROJECT_SETTINGS } from './projectSettings';
export type { TextAlign, TextStyle } from './textStyle';
export {
  createDefaultTextStyle,
  DEFAULT_TEXT_STYLE_NAME,
} from './textStyle';
export type {
  JobEntity,
  JobQueueStatus,
  JobType,
  PageRecord,
  ProjectSettingsRecord,
  ProjectRecord,
  RegionRecord,
  RegionRecordStatus,
  TextStyleAlign,
  TextStyleRecord,
} from './domain';
