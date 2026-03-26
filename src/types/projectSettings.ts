export type ProjectSourceLanguage = 'ja' | 'zh' | 'ko' | 'en' | 'auto';
export type ProjectTargetLanguage = 'ru' | 'en';
export type OcrEngineId = 'mock' | 'tesseract' | 'paddle' | 'manga-ocr';
export type TranslationProviderId = 'mock' | 'local' | 'remote';

export interface ProjectSettings {
  projectId: string;
  sourceLanguage: ProjectSourceLanguage;
  targetLanguage: ProjectTargetLanguage;
  ocrEngine: OcrEngineId;
  translationProvider: TranslationProviderId;
  defaultTextStyleId?: string;
}

export const DEFAULT_PROJECT_SETTINGS: Omit<ProjectSettings, 'projectId'> = {
  sourceLanguage: 'auto',
  targetLanguage: 'ru',
  ocrEngine: 'mock',
  translationProvider: 'mock',
};
