import { useState, useEffect, useCallback } from 'react';
import { BotIcon, PlusIcon, Trash2Icon, XIcon } from '../icons';
import {
  getSources,
  addSource,
  removeSource,
  toggleSource,
  getChapters,
  checkSource,
  checkAllSources,
  downloadChapterImages,
  markChapterDownloaded,
} from '../services/sourceMonitor';
import type { MangaSource, ChapterEntry, SourceCheckResult } from '../types/source';
import { usePageStore } from '../stores/usePageStore';
import { useToastStore } from '../stores/useToastStore';

export function SourcesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [sources, setSources] = useState<MangaSource[]>([]);
  const [chapters, setChapters] = useState<ChapterEntry[]>([]);
  const [tab, setTab] = useState<'sources' | 'chapters'>('sources');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<'rss' | 'scrape'>('rss');
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<SourceCheckResult[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    if (open) {
      setSources(getSources());
      setChapters(getChapters());
      setCheckResults([]);
    }
  }, [open]);

  const refresh = useCallback(() => {
    setSources(getSources());
    setChapters(getChapters());
  }, []);

  const handleAdd = useCallback(() => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    addSource(newTitle.trim(), newUrl.trim(), newType);
    setNewTitle('');
    setNewUrl('');
    setAdding(false);
    refresh();
    pushToast('Source added!', 'success');
  }, [newTitle, newUrl, newType, refresh, pushToast]);

  const handleCheckAll = useCallback(async () => {
    setChecking(true);
    setCheckResults([]);
    const results = await checkAllSources((current, total, title) => {
      pushToast(`Checking ${current}/${total}: ${title}`, 'info');
    });
    setCheckResults(results);
    refresh();
    setChecking(false);
    const totalNew = results.reduce((sum, r) => sum + r.newChapters.length, 0);
    if (totalNew > 0) {
      pushToast(`Found ${totalNew} new chapter(s)!`, 'success');
    } else {
      pushToast('No new chapters', 'info');
    }
  }, [refresh, pushToast]);

  const handleCheckOne = useCallback(async (source: MangaSource) => {
    setChecking(true);
    const result = await checkSource(source);
    setCheckResults([result]);
    refresh();
    setChecking(false);
    if (result.newChapters.length > 0) {
      pushToast(`${source.title}: ${result.newChapters.length} new chapter(s)`, 'success');
    } else {
      pushToast(`${source.title}: no new chapters`, 'info');
    }
  }, [refresh, pushToast]);

  const handleDownload = useCallback(async (chapter: ChapterEntry) => {
    setDownloading(chapter.id);
    try {
      const result = await downloadChapterImages(chapter.url);
      if (result.error) {
        pushToast(`Download error: ${result.error}`, 'error');
        return;
      }
      if (result.images.length === 0) {
        pushToast('No images found', 'warning');
        return;
      }

      const files: File[] = result.images.map(
        (blob, i) => new File([blob], `page_${i + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`, { type: blob.type }),
      );
      const count = await usePageStore.getState().addPages(files);

      markChapterDownloaded(chapter.id);
      refresh();
      pushToast(`Imported ${count} pages for ch. ${chapter.chapterNumber}`, 'success');
    } catch (err) {
      pushToast(`Download failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    setDownloading(null);
  }, [refresh, pushToast]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[70vh] w-full max-w-lg flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <BotIcon size={16} />
          <span className="text-sm font-semibold text-zinc-200">Источники</span>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setTab('sources')}
              className={`rounded-md px-2 py-1 text-[10px] ${tab === 'sources' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Подписки
            </button>
            <button
              onClick={() => setTab('chapters')}
              className={`rounded-md px-2 py-1 text-[10px] ${tab === 'chapters' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Главы
            </button>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 'sources' && (
            <div className="space-y-2">
              {sources.length === 0 && !adding && (
                <p className="py-8 text-center text-[11px] text-zinc-600">
                  Нет источников. Добавь RSS фид или URL страницы с главами.
                </p>
              )}

              {sources.map((src) => (
                <div key={src.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
                  <input
                    type="checkbox"
                    checked={src.enabled}
                    onChange={() => { toggleSource(src.id); refresh(); }}
                    className="accent-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-zinc-200">{src.title}</div>
                    <div className="truncate text-[9px] text-zinc-500">{src.url}</div>
                    <div className="mt-0.5 text-[9px] text-zinc-600">
                      {src.type.toUpperCase()}
                      {src.lastCheckedAt && ` · checked ${new Date(src.lastCheckedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckOne(src)}
                    disabled={checking}
                    className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Check
                  </button>
                  <button
                    onClick={() => { removeSource(src.id); refresh(); }}
                    className="text-zinc-600 hover:text-red-400"
                  >
                    <Trash2Icon size={12} />
                  </button>
                </div>
              ))}

              {adding && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <input
                    type="text"
                    placeholder="Название (например, One Piece)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300"
                  />
                  <input
                    type="text"
                    placeholder="URL (RSS или страница с главами)"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300"
                  />
                  <div className="mb-2 flex gap-2">
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <input
                        type="radio"
                        name="src-type"
                        checked={newType === 'rss'}
                        onChange={() => setNewType('rss')}
                        className="accent-indigo-500"
                      />
                      RSS
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <input
                        type="radio"
                        name="src-type"
                        checked={newType === 'scrape'}
                        onChange={() => setNewType('scrape')}
                        className="accent-indigo-500"
                      />
                      Scrape
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={!newTitle.trim() || !newUrl.trim()}
                      className="flex-1 rounded-md bg-indigo-500/20 py-1.5 text-[11px] text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setAdding(false)}
                      className="rounded-md bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setAdding(true)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-zinc-800 py-2 text-[11px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                >
                  <PlusIcon size={12} />
                  Add source
                </button>
                <button
                  onClick={handleCheckAll}
                  disabled={checking || sources.length === 0}
                  className="flex items-center justify-center gap-1 rounded-md bg-indigo-500/20 px-3 py-2 text-[11px] text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
                >
                  {checking ? '...' : 'Check all'}
                </button>
              </div>

              {/* Check results */}
              {checkResults.map((r) => (
                <div key={r.sourceId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-[10px]">
                  <span className="text-zinc-400">{r.title}:</span>{' '}
                  {r.error ? (
                    <span className="text-red-400">{r.error}</span>
                  ) : (
                    <span className="text-emerald-400">
                      {r.newChapters.length > 0
                        ? `${r.newChapters.length} new — ${r.newChapters.map((c) => c.chapterNumber).join(', ')}`
                        : 'up to date'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'chapters' && (
            <div className="space-y-1">
              {chapters.length === 0 && (
                <p className="py-8 text-center text-[11px] text-zinc-600">
                  No chapters found. Check your sources.
                </p>
              )}
              {chapters.map((ch) => (
                <div key={ch.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-zinc-200">
                      Ch. {ch.chapterNumber}
                      {ch.downloaded && (
                        <span className="ml-1.5 text-[9px] text-emerald-500">✓</span>
                      )}
                    </div>
                    <div className="truncate text-[9px] text-zinc-500">{ch.title}</div>
                  </div>
                  <button
                    onClick={() => handleDownload(ch)}
                    disabled={downloading === ch.id || ch.downloaded}
                    className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    {downloading === ch.id ? '...' : ch.downloaded ? 'Done' : 'Get'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
