export type ProjectSourceLanguage = 'ja' | 'zh' | 'ko' | 'en' | 'auto';
export type ProjectTargetLanguage = 'ru' | 'en';
export type OcrEngineId = 'mock' | 'windows' | 'tesseract' | 'paddle' | 'manga-ocr' | 'easyocr';
export type TranslationProviderId = 'mock' | 'local' | 'remote' | 'offline' | 'deepl' | 'libre' | 'ollama' | 'sakura';
export type InpaintingProviderId = 'basic' | 'iopaint';

export interface ProjectSettings {
  projectId: string;
  sourceLanguage: ProjectSourceLanguage;
  targetLanguage: ProjectTargetLanguage;
  ocrEngine: OcrEngineId;
  translationProvider: TranslationProviderId;
  defaultTextStyleId?: string;
  autoRunOcr: boolean;
  inpaintingProvider: InpaintingProviderId;
}

export const DEFAULT_PROJECT_SETTINGS: Omit<ProjectSettings, 'projectId'> = {
  sourceLanguage: 'auto',
  targetLanguage: 'ru',
  ocrEngine: 'mock',
  translationProvider: 'mock',
  autoRunOcr: false,
  inpaintingProvider: 'basic',
};
