import { invoke, isTauri } from '@tauri-apps/api/core';
import { ensureProjectDomainDefaults } from '../repositories/projectDefaults';
import { pageRepository } from '../repositories/pageRepository';
import { regionRepository } from '../repositories/regionRepository';
import type {
  Page,
  ProjectTargetLanguage,
  RegionRecord,
  TranslationPageResult,
  TranslationProviderId,
} from '../types';

type TranslationProgressCallback = (progress: number, message: string) => void;

interface TranslationRunOptions {
  regionIds?: string[];
  overwriteExisting?: boolean;
}

interface StoredTranslationContext {
  projectId: string;
  sourceLanguage?: string;
  targetLanguage: ProjectTargetLanguage;
  translationProvider: TranslationProviderId | string;
  regions: RegionRecord[];
}

const EN_TO_RU: Record<string, string> = {
  hello: 'привет',
  hi: 'привет',
  yes: 'да',
  no: 'нет',
  thanks: 'спасибо',
  thank: 'спасибо',
  sorry: 'прости',
  please: 'пожалуйста',
  wait: 'подожди',
  stop: 'стой',
  run: 'беги',
  go: 'иди',
  what: 'что',
  where: 'где',
  who: 'кто',
  why: 'почему',
  mission: 'миссия',
  danger: 'опасность',
  enemy: 'враг',
  friend: 'друг',
  captain: 'капитан',
  system: 'система',
  power: 'сила',
  test: 'тест',
  attack: 'атака',
  region: 'регион',
  page: 'страница',
  translation: 'перевод',
  start: 'старт',
  finish: 'финиш',
  open: 'открыть',
  close: 'закрыть',
  save: 'сохранить',
};

const RU_TO_EN: Record<string, string> = {
  привет: 'hello',
  да: 'yes',
  нет: 'no',
  спасибо: 'thanks',
  прости: 'sorry',
  пожалуйста: 'please',
  подожди: 'wait',
  стой: 'stop',
  беги: 'run',
  иди: 'go',
  что: 'what',
  где: 'where',
  кто: 'who',
  почему: 'why',
  миссия: 'mission',
  опасность: 'danger',
  враг: 'enemy',
  друг: 'friend',
  капитан: 'captain',
  система: 'system',
  сила: 'power',
  тест: 'test',
  атака: 'attack',
  регион: 'region',
  страница: 'page',
  перевод: 'translation',
  старт: 'start',
  финиш: 'finish',
  открыть: 'open',
  закрыть: 'close',
  сохранить: 'save',
};

function isWordToken(value: string) {
  return /^[\p{L}\p{N}']+$/u.test(value);
}

function preserveCase(source: string, translated: string) {
  if (!source) return translated;
  if (source === source.toUpperCase()) {
    return translated.toUpperCase();
  }
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return translated[0]?.toUpperCase() + translated.slice(1);
  }
  return translated;
}

function translateKnownWord(token: string, targetLanguage: ProjectTargetLanguage) {
  const normalized = token.toLowerCase();
  const dictionary = targetLanguage === 'ru' ? EN_TO_RU : RU_TO_EN;
  const translated = dictionary[normalized];
  return translated ? preserveCase(token, translated) : null;
}

function tokenizeText(text: string) {
  return text.match(/[\p{L}\p{N}']+|[^\p{L}\p{N}']+/gu) ?? [text];
}

function buildLocalDraftTranslation(text: string, targetLanguage: ProjectTargetLanguage) {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  let translatedWords = 0;
  const output = tokenizeText(trimmed)
    .map((token) => {
      if (!isWordToken(token)) {
        return token;
      }

      const translated = translateKnownWord(token, targetLanguage);
      if (translated) {
        translatedWords += 1;
        return translated;
      }
      return token;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (!output || translatedWords === 0 || output === trimmed) {
    return `${targetLanguage === 'ru' ? '[ru draft]' : '[en draft]'} ${trimmed}`;
  }

  return output;
}

function buildPreviewTranslation(text: string, targetLanguage: ProjectTargetLanguage) {
  return `${targetLanguage === 'ru' ? '[preview ru]' : '[preview en]'} ${text.trim()}`;
}

function filterTargetRegions(regions: RegionRecord[], regionIds?: string[]) {
  if (!regionIds || regionIds.length === 0) {
    return regions;
  }

  const targetIds = new Set(regionIds);
  return regions.filter((region) => targetIds.has(region.id));
}

async function loadStoredTranslationContext(
  page: Page,
  options: TranslationRunOptions,
): Promise<StoredTranslationContext> {
  const [pageRecord, regionRecords] = await Promise.all([
    pageRepository.getById(page.id),
    regionRepository.getByPage(page.id),
  ]);

  if (!pageRecord) {
    throw new Error('Page is not synced to domain storage');
  }

  const settings = await ensureProjectDomainDefaults(pageRecord.projectId);

  return {
    projectId: pageRecord.projectId,
    sourceLanguage: settings.sourceLanguage === 'auto' ? undefined : settings.sourceLanguage,
    targetLanguage: settings.targetLanguage,
    translationProvider: settings.translationProvider,
    regions: filterTargetRegions(regionRecords, options.regionIds),
  };
}

async function applyBrowserTranslationResult(
  context: StoredTranslationContext,
  results: TranslationPageResult['results'],
) {
  const resultMap = new Map(results.map((result) => [result.regionId, result] as const));
  const updatedAt = Date.now();

  await Promise.all(
    context.regions.map(async (record) => {
      const result = resultMap.get(record.id);
      if (!result || result.skipped || !result.translatedText) {
        return;
      }

      await regionRepository.update({
        ...record,
        translatedText: result.translatedText,
        status: 'translated',
        targetLanguage: context.targetLanguage,
        translationStatus: 'done',
        translationProvider: String(context.translationProvider),
        translationUpdatedAt: updatedAt,
      });
    }),
  );
}

async function runBrowserTranslation(
  page: Page,
  options: TranslationRunOptions,
  onProgress?: TranslationProgressCallback,
): Promise<TranslationPageResult> {
  const context = await loadStoredTranslationContext(page, options);
  if (context.regions.length === 0) {
    throw new Error('No regions selected for translation');
  }

  const overwriteExisting = options.overwriteExisting ?? false;
  const provider = context.translationProvider === 'local' ? 'local' : context.translationProvider;
  const providerName =
    provider === 'local' ? 'scanforge-local-draft' : 'scanforge-translation-preview';
  const results: TranslationPageResult['results'] = [];

  for (let index = 0; index < context.regions.length; index += 1) {
    const region = context.regions[index];
    await new Promise((resolve) => window.setTimeout(resolve, 50));

    if (region.locked) {
      results.push({
        regionId: region.id,
        translatedText: null,
        skipped: true,
        reason: 'locked',
      });
    } else if (!region.sourceText.trim()) {
      results.push({
        regionId: region.id,
        translatedText: null,
        skipped: true,
        reason: 'empty_source',
      });
    } else if (!overwriteExisting && region.translatedText.trim()) {
      results.push({
        regionId: region.id,
        translatedText: null,
        skipped: true,
        reason: 'already_translated',
      });
    } else {
      const translatedText =
        provider === 'local'
          ? buildLocalDraftTranslation(region.sourceText, context.targetLanguage)
          : buildPreviewTranslation(region.sourceText, context.targetLanguage);

      results.push({
        regionId: region.id,
        translatedText,
        skipped: false,
        reason: null,
      });
    }

    onProgress?.(
      0.2 + ((index + 1) / Math.max(1, context.regions.length)) * 0.7,
      `Translating region ${index + 1}/${context.regions.length}`,
    );
  }

  await applyBrowserTranslationResult(context, results);

  const translatedCount = results.filter((item) => !item.skipped && item.translatedText).length;
  const skippedCount = results.length - translatedCount;

  return {
    provider: providerName,
    regionsProcessed: results.length,
    translatedCount,
    skippedCount,
    results,
  };
}

export async function runPageTranslation(
  page: Page,
  options: TranslationRunOptions = {},
  onProgress?: TranslationProgressCallback,
): Promise<TranslationPageResult> {
  if (!isTauri()) {
    onProgress?.(0.15, 'Running browser translation provider');
    return runBrowserTranslation(page, options, onProgress);
  }

  onProgress?.(0.2, 'Reading translation input from domain storage');
  onProgress?.(0.55, 'Running Tauri translation backend');
  return invoke<TranslationPageResult>('run_page_translation', {
    pageId: page.id,
    regionIds: options.regionIds,
    overwriteExisting: options.overwriteExisting ?? false,
  });
}
