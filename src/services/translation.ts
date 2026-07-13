import { invoke } from '@tauri-apps/api/core';
import { ensureProjectDomainDefaults } from '../repositories/projectDefaults';
import { pageRepository } from '../repositories/pageRepository';
import { regionRepository } from '../repositories/regionRepository';
import {
  buildLocalDraftTranslation,
  buildPreviewTranslation,
} from './translationDraft';
import { translateOffline } from './translation/offline';
import { translateViaHttp } from './translation/providers';
import { createAiProvider } from './ai/provider';
import type { AiConfig } from './ai/types';
import type {
  Page,
  ProjectTargetLanguage,
  RegionRecord,
  TranslationPageResult,
  TranslationProviderId,
} from '../types';
import { isDesktopRuntime } from '../utils/runtime';

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

const TRANSLATION_PROVIDER_FALLBACKS: Record<string, string[]> = {
  local: ['local', 'mock'],
  mock: ['mock'],
  remote: ['remote', 'local', 'mock'],
  offline: ['offline', 'local', 'mock'],
  deepl: ['deepl', 'local', 'mock'],
  libre: ['libre', 'local', 'mock'],
  ollama: ['ollama', 'local', 'mock'],
  sakura: ['sakura', 'ollama', 'local', 'mock'],
};

function getTranslationProviderChain(provider: TranslationProviderId | string) {
  return TRANSLATION_PROVIDER_FALLBACKS[provider] ?? [provider, 'local', 'mock'];
}

function getTranslationProviderName(provider: string) {
  switch (provider) {
    case 'local':
      return 'scanforge-local-draft';
    case 'mock':
      return 'scanforge-translation-preview';
    case 'remote':
      return 'scanforge-translation-remote';
    case 'offline':
      return 'scanforge-offline-kuromoji';
    case 'deepl':
      return 'deepl-api';
    case 'libre':
      return 'libre-translate';
    case 'ollama':
      return 'ollama-llm';
    case 'sakura':
      return 'sakura-llm';
    default:
      return provider;
  }
}

function describeTranslationProviderLabel(provider: string, providerPath?: string[]) {
  if (providerPath && providerPath.length > 1) {
    return `${provider} via ${providerPath.slice(0, -1).join(' -> ')}`;
  }

  return provider;
}

function isBrowserTranslationProviderAvailable(provider: string) {
  return provider === 'local' || provider === 'mock' || provider === 'offline'
    || provider === 'deepl' || provider === 'libre' || provider === 'ollama'
    || provider === 'sakura';
}

async function runBrowserProviderTranslation(
  provider: string,
  sourceText: string,
  targetLanguage: ProjectTargetLanguage,
): Promise<string | null> {
  switch (provider) {
    case 'local':
      return buildLocalDraftTranslation(sourceText, targetLanguage);
    case 'mock':
      return buildPreviewTranslation(sourceText, targetLanguage);
    case 'offline': {
      const result = await translateOffline(sourceText, targetLanguage);
      return result.text;
    }
    case 'deepl':
      return translateViaHttp('deepl', sourceText, targetLanguage);
    case 'libre':
      return translateViaHttp('libre', sourceText, targetLanguage);
    case 'ollama': {
      const ollamaConfig: AiConfig = {
        provider: 'ollama',
        model: localStorage.getItem('scanforge.ollama.model') || 'llama3.2:1b',
        baseUrl: localStorage.getItem('scanforge.ollama.endpoint') || 'http://localhost:11434',
        apiKey: '',
        maxTokens: 512,
        temperature: 0.3,
      };
      const provider = createAiProvider(ollamaConfig);
      const result = await provider.chat(
        [{ role: 'user', content: `Translate the following Japanese manga text to ${targetLanguage === 'ru' ? 'Russian' : 'English'}. Keep it concise and natural for a speech bubble. Return ONLY the translation, no explanations:\n\n${sourceText}` }],
        [],
        undefined,
      );
      return result.content || null;
    }
    case 'sakura': {
      const sakuraConfig: AiConfig = {
        provider: 'ollama',
        model: localStorage.getItem('scanforge.sakura.model') || 'sakura-1.5b',
        baseUrl: localStorage.getItem('scanforge.sakura.endpoint') || 'http://localhost:11434',
        apiKey: '',
        maxTokens: 512,
        temperature: 0.2,
      };
      const provider = createAiProvider(sakuraConfig);
      const lang = targetLanguage === 'ru' ? 'Russian' : 'English';
      const result = await provider.chat(
        [{
          role: 'system',
          content: 'You are a professional manga translator. Translate Japanese text to ' + lang + '. Preserve names, onomatopoeia, and cultural terms. Keep the translation natural for speech bubbles.',
        }, {
          role: 'user',
          content: sourceText,
        }],
        [],
        undefined,
      );
      return result.content || null;
    }
    default:
      return null;
  }
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
  providerName: string,
  providerPath?: string[],
) {
  const resultMap = new Map(results.map((result) => [result.regionId, result] as const));
  const updatedAt = Date.now();
  const providerLabel = describeTranslationProviderLabel(providerName, providerPath);

  await Promise.all(
    context.regions.map(async (record) => {
      const result = resultMap.get(record.id);
      if (!result) {
        return;
      }

      if (result.skipped) {
        if (result.reason === 'locked') {
          return;
        }

        if (result.reason === 'already_translated' && record.translatedText.trim()) {
          await regionRepository.update({
            ...record,
            status: 'translated',
            targetLanguage: context.targetLanguage,
            translationStatus: 'done',
            translationProvider: record.translationProvider ?? providerLabel,
            translationUpdatedAt: record.translationUpdatedAt ?? updatedAt,
          });
          return;
        }

        await regionRepository.update({
          ...record,
          status: record.translatedText.trim()
            ? 'translated'
            : record.sourceText.trim()
              ? 'ocr_done'
              : 'idle',
          targetLanguage: context.targetLanguage,
          translationStatus: 'failed',
          translationProvider:
            result.reason === 'provider_unavailable'
              ? providerLabel
              : record.translationProvider,
          translationUpdatedAt: updatedAt,
        });
        return;
      }

      if (!result.translatedText) {
        return;
      }

      await regionRepository.update({
        ...record,
        translatedText: result.translatedText,
        status: 'translated',
        targetLanguage: context.targetLanguage,
        translationStatus: 'done',
        translationProvider: providerLabel,
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
  const providerChain = getTranslationProviderChain(context.translationProvider);
  const providerPath: string[] = [];
  let activeProvider = 'mock';
  const results: TranslationPageResult['results'] = [];

  for (const provider of providerChain) {
    providerPath.push(provider);
    if (!isBrowserTranslationProviderAvailable(provider)) {
      continue;
    }

    activeProvider = provider;
    break;
  }

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
      let translatedText: string | null = null;

      translatedText = await runBrowserProviderTranslation(
        activeProvider,
        region.sourceText,
        context.targetLanguage,
      );

      if (!translatedText) {
        results.push({
          regionId: region.id,
          translatedText: null,
          skipped: true,
          reason: 'provider_unavailable',
        });
        onProgress?.(
          0.2 + ((index + 1) / Math.max(1, context.regions.length)) * 0.7,
          `Translating region ${index + 1}/${context.regions.length}`,
        );
        continue;
      }

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

  const providerName = getTranslationProviderName(activeProvider);
  await applyBrowserTranslationResult(context, results, providerName, providerPath);

  const translatedCount = results.filter((item) => !item.skipped && item.translatedText).length;
  const skippedCount = results.length - translatedCount;

  return {
    provider: providerName,
    ...(providerPath.length > 0 ? { providerPath } : {}),
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
  if (!isDesktopRuntime()) {
    onProgress?.(0.15, 'Running browser translation provider');
    return runBrowserTranslation(page, options, onProgress);
  }

  // Offline provider runs in-browser even on desktop (uses kuromoji.js + dictionary)
  const context = await loadStoredTranslationContext(page, options);
  if (context.translationProvider === 'offline') {
    onProgress?.(0.15, 'Running offline browser translation provider');
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
