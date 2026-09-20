export interface MangaTranslatorConfig {
  enabled: boolean;
  endpoint: string;
}

export interface MtTranslateRequest {
  image: string; // base64
  sourceLang: string;
  targetLang: string;
}

export interface MtTranslateResponse {
  translatedImage: string; // base64
  elapsed: number;
}

const STORAGE_KEY = 'scanforge-mt-config';
const REQUEST_TIMEOUT_MS = 30_000;

export function getMtConfig(): MangaTranslatorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { enabled: false, endpoint: 'http://localhost:5003', ...JSON.parse(raw) };
  } catch {}
  return { enabled: false, endpoint: 'http://localhost:5003' };
}

export function setMtConfig(config: MangaTranslatorConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function translateViaMangaTranslator(
  imageDataUrl: string,
  sourceLang: string,
  targetLang: string,
): Promise<MtTranslateResponse> {
  const config = getMtConfig();
  if (!config.enabled) throw new Error('manga-translator is disabled');

  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
    throw new Error('Manga Translator endpoint must use HTTP(S)');
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const base64 = imageDataUrl.split(',')[1] || imageDataUrl;
    const resp = await fetch(`${endpoint.href.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        source_lang: sourceLang === 'ja' ? 'JPN' : sourceLang.toUpperCase(),
        target_lang: targetLang === 'ru' ? 'RUS' : targetLang.toUpperCase(),
        translator: 'google',
        detector: 'default',
        ocr: 'default',
        inpainter: 'lama',
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new Error(`manga-translator error: ${resp.status} ${resp.statusText}`);
    }

    const data: unknown = await resp.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('image' in data) ||
      typeof data.image !== 'string' ||
      !data.image.trim()
    ) {
      throw new Error('manga-translator response is missing a valid image payload');
    }

    const elapsed =
      'elapsed' in data && typeof data.elapsed === 'number' && Number.isFinite(data.elapsed)
        ? data.elapsed
        : 0;

    return {
      translatedImage: `data:image/png;base64,${data.image}`,
      elapsed,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`manga-translator request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
