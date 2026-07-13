import type { MangaSource, ChapterEntry, SourceCheckResult } from '../types/source';

const SOURCES_KEY = 'scanforge-sources';
const CHAPTERS_KEY = 'scanforge-chapters';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadSources(): MangaSource[] {
  try {
    const raw = localStorage.getItem(SOURCES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSources(sources: MangaSource[]) {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

function loadChapters(): ChapterEntry[] {
  try {
    const raw = localStorage.getItem(CHAPTERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChapters(chapters: ChapterEntry[]) {
  localStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters));
}

// ---------------------------------------------------------------------------
// RSS Feed parser
// ---------------------------------------------------------------------------

async function parseRssFeed(
  source: MangaSource,
): Promise<{ chapters: ChapterEntry[]; error?: string }> {
  try {
    const resp = await fetch(source.url, {
      headers: { 'User-Agent': 'ScanForge/0.1' },
    });
    if (!resp.ok) return { chapters: [], error: `HTTP ${resp.status}` };

    const xml = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const items = doc.querySelectorAll('item');
    const chapters: ChapterEntry[] = [];

    for (const item of items) {
      const title = item.querySelector('title')?.textContent?.trim() || 'Unknown';
      const link = item.querySelector('link')?.textContent?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.textContent?.trim();

      const chapterNumber = extractChapterNumber(title);
      const publishedAt = pubDate ? new Date(pubDate).getTime() : Date.now();

      chapters.push({
        id: `${source.id}-${chapterNumber}`,
        sourceId: source.id,
        title,
        chapterNumber,
        url: link,
        publishedAt,
        downloaded: false,
        addedAt: Date.now(),
      });
    }

    return { chapters };
  } catch (err) {
    return { chapters: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// HTML Scraper (basic)
// ---------------------------------------------------------------------------

async function scrapeChapterList(
  source: MangaSource,
): Promise<{ chapters: ChapterEntry[]; error?: string }> {
  try {
    const resp = await fetch(source.url, {
      headers: { 'User-Agent': 'ScanForge/0.1' },
    });
    if (!resp.ok) return { chapters: [], error: `HTTP ${resp.status}` };

    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const chapters: ChapterEntry[] = [];
    const links = doc.querySelectorAll('a');

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const text = link.textContent?.trim() || '';

      const chapterNum = extractChapterNumber(text);
      if (!chapterNum) continue;

      const fullUrl = new URL(href, source.url).href;
      chapters.push({
        id: `${source.id}-${chapterNum}`,
        sourceId: source.id,
        title: text,
        chapterNumber: chapterNum,
        url: fullUrl,
        publishedAt: Date.now(),
        downloaded: false,
        addedAt: Date.now(),
      });
    }

    return { chapters };
  } catch (err) {
    return { chapters: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// Chapter number extraction
// ---------------------------------------------------------------------------

function extractChapterNumber(text: string): string {
  const patterns = [
    /(?:chapter|ch|гл|глава|episode|ep)\s*\.?\s*([\d.]+)/i,
    /([\d.]+)\s*(?:chapter|ch|гл|глава|episode|ep)/i,
    /vol\.?\s*[\d.]+\s*(?:ch|chapter)?\.?\s*([\d.]+)/i,
    /(?:т(?:ом)?\s*[\d.]+)\s*(?:гл|глава)?\.?\s*([\d.]+)/i,
    /(\d+\.?\d*)/,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1];
  }
  return '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSources(): MangaSource[] {
  return loadSources();
}

export function addSource(title: string, url: string, type: 'rss' | 'scrape'): MangaSource {
  const sources = loadSources();
  const source: MangaSource = {
    id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    url,
    type,
    lastCheckedAt: null,
    enabled: true,
  };
  sources.push(source);
  saveSources(sources);
  return source;
}

export function removeSource(id: string) {
  const sources = loadSources().filter((s) => s.id !== id);
  saveSources(sources);

  const chapters = loadChapters().filter((c) => c.sourceId !== id);
  saveChapters(chapters);
}

export function toggleSource(id: string) {
  const sources = loadSources().map((s) =>
    s.id === id ? { ...s, enabled: !s.enabled } : s,
  );
  saveSources(sources);
}

export function getChapters(sourceId?: string): ChapterEntry[] {
  const chapters = loadChapters();
  if (sourceId) return chapters.filter((c) => c.sourceId === sourceId);
  return chapters.sort((a, b) => b.publishedAt - a.publishedAt);
}

export function markChapterDownloaded(chapterId: string) {
  const chapters = loadChapters().map((c) =>
    c.id === chapterId ? { ...c, downloaded: true } : c,
  );
  saveChapters(chapters);
}

export async function checkSource(
  source: MangaSource,
): Promise<SourceCheckResult> {
  const result: SourceCheckResult = {
    sourceId: source.id,
    title: source.title,
    newChapters: [],
  };

  const fetchResult =
    source.type === 'rss' ? await parseRssFeed(source) : await scrapeChapterList(source);

  if (fetchResult.error) {
    result.error = fetchResult.error;
    return result;
  }

  const existing = loadChapters();
  const existingIds = new Set(existing.map((c) => c.id));

  const fresh = fetchResult.chapters.filter((c) => !existingIds.has(c.id));
  if (fresh.length === 0) return result;

  const allChapters = [...existing, ...fresh];
  saveChapters(allChapters);

  // Update source lastCheckedAt
  const sources = loadSources().map((s) =>
    s.id === source.id ? { ...s, lastCheckedAt: Date.now() } : s,
  );
  saveSources(sources);

  result.newChapters = fresh;
  return result;
}

export async function checkAllSources(
  onProgress?: (current: number, total: number, title: string) => void,
): Promise<SourceCheckResult[]> {
  const sources = loadSources().filter((s) => s.enabled);
  const results: SourceCheckResult[] = [];

  for (let i = 0; i < sources.length; i++) {
    onProgress?.(i + 1, sources.length, sources[i].title);
    const result = await checkSource(sources[i]);
    results.push(result);
  }

  return results;
}

export async function downloadChapterImages(
  chapterUrl: string,
): Promise<{ images: Blob[]; error?: string }> {
  try {
    const resp = await fetch(chapterUrl, {
      headers: { 'User-Agent': 'ScanForge/0.1' },
    });
    if (!resp.ok) return { images: [], error: `HTTP ${resp.status}` };

    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const imageUrls: string[] = [];
    const imgs = doc.querySelectorAll('img');

    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      if (isPageImage(src)) {
        try {
          const fullUrl = new URL(src, chapterUrl).href;
          if (!imageUrls.includes(fullUrl)) imageUrls.push(fullUrl);
        } catch {}
      }
    }

    if (imageUrls.length === 0) {
      return { images: [], error: 'No images found on page' };
    }

    const blobs: Blob[] = [];
    for (const url of imageUrls) {
      try {
        const imgResp = await fetch(url);
        if (imgResp.ok) {
          blobs.push(await imgResp.blob());
        }
      } catch {}
    }

    return { images: blobs };
  } catch (err) {
    return { images: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function isPageImage(url: string): boolean {
  const ext = url.split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|bmp)$/.test(ext);
}
