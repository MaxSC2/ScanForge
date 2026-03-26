import type {
  OcrEngineId,
  ProjectSettings,
  ProjectSourceLanguage,
  ProjectTargetLanguage,
  TranslationProviderId,
} from './projectSettings';
import type {
  TextAlign,
  TextStyle,
} from './textStyle';
import type {
  RegionKind,
  RegionOcrStatus,
  RegionOrientation,
  RegionTranslationStatus,
} from './region';

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
  label: string;
  kind: RegionKind;
  order: number;
  orientation: RegionOrientation;
  sourceText: string;
  sourceLanguage?: ProjectSourceLanguage;
  translatedText: string;
  status: RegionRecordStatus;
  ocrStatus: RegionOcrStatus;
  ocrEngine?: OcrEngineId;
  ocrUpdatedAt?: number;
  targetLanguage?: ProjectTargetLanguage;
  translationStatus: RegionTranslationStatus;
  translationProvider?: TranslationProviderId;
  translationUpdatedAt?: number;
  notes: string;
  locked: boolean;
  visible: boolean;
  textStyleId?: string;
  ocrConfidence?: number;
}

export type ProjectSettingsRecord = ProjectSettings;
export type TextStyleRecord = TextStyle;
export type TextStyleAlign = TextAlign;

export type JobType = 'OCR' | 'TRANSLATE';
export type JobQueueStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobEntity {
  id: string;
  type: JobType;
  status: JobQueueStatus;
  projectId: string;
  pageId?: string;
  regionIds?: string[];
  progress: number;
  createdAt: number;
  updatedAt: number;
  summary?: string;
  error?: string;
}
