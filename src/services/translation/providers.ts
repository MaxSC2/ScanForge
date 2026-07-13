const DEEPL_FREE_API = 'https://api-free.deepl.com/v2/translate';

interface TranslateOptions {
  text: string;
  sourceLang: string;
  targetLang: 'RU' | 'EN';
}

async function deeplTranslate({ text, sourceLang, targetLang }: TranslateOptions): Promise<string | null> {
  const apiKey = localStorage.getItem('scanforge.deepl.api_key');
  if (!apiKey) return null;

  try {
    const res = await fetch(DEEPL_FREE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${apiKey}` },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang.toUpperCase(),
        target_lang: targetLang,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

async function libreTranslate({ text, sourceLang, targetLang }: TranslateOptions): Promise<string | null> {
  const baseUrl = localStorage.getItem('scanforge.libre.url') || 'http://localhost:5000';
  const apiKey = localStorage.getItem('scanforge.libre.api_key') || '';

  try {
    const res = await fetch(`${baseUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        q: text,
        source: sourceLang === 'auto' ? 'auto' : sourceLang.toLowerCase(),
        target: targetLang.toLowerCase(),
        format: 'text',
        api_key: apiKey || undefined,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.translatedText ?? null;
  } catch {
    return null;
  }
}

export async function translateViaHttp(
  provider: 'deepl' | 'libre',
  text: string,
  targetLang: 'ru' | 'en',
): Promise<string | null> {
  const opts: TranslateOptions = {
    text,
    sourceLang: 'ja',
    targetLang: targetLang === 'ru' ? 'RU' : 'EN',
  };

  switch (provider) {
    case 'deepl':
      return deeplTranslate(opts);
    case 'libre':
      return libreTranslate(opts);
  }
}
