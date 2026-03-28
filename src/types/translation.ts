import type {
  ProjectSourceLanguage,
  ProjectTargetLanguage,
  TranslationProviderId,
} from './projectSettings';
import type { RegionKind } from './region';

export interface TranslationInputItem {
  regionId: string;
  text: string;
  kind: RegionKind;
  notes?: string;
  locked: boolean;
  translatedText?: string;
}

export interface TranslationPagePayload {
  projectId: string;
  pageId: string;
  sourceLanguage?: ProjectSourceLanguage;
  targetLanguage: ProjectTargetLanguage;
  provider: TranslationProviderId | string;
  overwriteExisting: boolean;
  items: TranslationInputItem[];
}

export interface TranslationRegionResult {
  regionId: string;
  translatedText: string | null;
  skipped: boolean;
  reason: string | null;
}

export interface TranslationPageResult {
  provider: string;
  providerPath?: string[];
  regionsProcessed: number;
  translatedCount: number;
  skippedCount: number;
  results: TranslationRegionResult[];
}
