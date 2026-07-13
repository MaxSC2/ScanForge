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

  // Strip data URL prefix to get raw base64
  const base64 = imageDataUrl.split(',')[1] || imageDataUrl;

  const resp = await fetch(`${config.endpoint}/translate`, {
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
  });

  if (!resp.ok) {
    throw new Error(`manga-translator error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return {
    translatedImage: `data:image/png;base64,${data.image}`,
    elapsed: data.elapsed || 0,
  };
}
