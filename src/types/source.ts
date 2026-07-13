export interface MangaSource {
  id: string;
  title: string;
  url: string;
  type: 'rss' | 'scrape';
  lastCheckedAt: number | null;
  enabled: boolean;
}

export interface ChapterEntry {
  id: string;
  sourceId: string;
  title: string;
  chapterNumber: string;
  url: string;
  publishedAt: number;
  downloaded: boolean;
  addedAt: number;
}

export interface SourceCheckResult {
  sourceId: string;
  title: string;
  newChapters: ChapterEntry[];
  error?: string;
}
