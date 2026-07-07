import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ChevronDownIcon, ScanTextIcon, LanguagesIcon } from '../icons';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';

type RegionStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';

function countByStatus(
  regions: { ocrStatus: RegionStatus; translationStatus: RegionStatus }[],
  field: 'ocrStatus' | 'translationStatus',
) {
  const counts = { idle: 0, queued: 0, running: 0, done: 0, failed: 0 };
  for (const r of regions) {
    counts[r[field]]++;
  }
  return counts;
}

export function PipelineStatusPanel() {
  const pages = usePageStore((s) => s.pages);
  const activePageId = usePageStore((s) => s.activePageId);
  const setActivePage = usePageStore((s) => s.setActivePage);
  const queueOcrJobs = useJobStore((s) => s.queueOcrJobs);
  const queueTranslationJobs = useJobStore((s) => s.queueTranslationJobs);
  const cancelOcrJobs = useJobStore((s) => s.cancelOcrJobs);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  const pageStats = useMemo(() => {
    return pages.map((page) => {
      const regions = page.regions ?? [];
      const ocrCounts = countByStatus(regions, 'ocrStatus');
      const translateCounts = countByStatus(regions, 'translationStatus');
      const ocrTotal = regions.length;
      const translateTotal = regions.length;
      const ocrProgress = ocrTotal > 0 ? (ocrCounts.done + ocrCounts.failed) / ocrTotal : 0;
      const translateProgress =
        translateTotal > 0 ? (translateCounts.done + translateCounts.failed) / translateTotal : 0;
      const failedOcr = ocrCounts.failed;
      const failedTranslate = translateCounts.failed;
      return { page, ocrCounts, translateCounts, ocrProgress, translateProgress, failedOcr, failedTranslate, ocrTotal, translateTotal };
    });
  }, [pages]);

  const ocrDoneTotal = pageStats.reduce((s, p) => s + p.ocrCounts.done, 0);
  const ocrIdleTotal = pageStats.reduce((s, p) => s + p.ocrCounts.idle, 0);
  const ocrQueuedTotal = pageStats.reduce((s, p) => s + p.ocrCounts.queued, 0);
  const ocrFailedTotal = pageStats.reduce((s, p) => s + p.ocrCounts.failed, 0);
  const translateDoneTotal = pageStats.reduce((s, p) => s + p.translateCounts.done, 0);
  const translateIdleTotal = pageStats.reduce((s, p) => s + p.translateCounts.idle, 0);
  const translateFailedTotal = pageStats.reduce((s, p) => s + p.translateCounts.failed, 0);

  const totalRegions = pageStats.reduce((s, p) => s + p.ocrTotal, 0);
  const ocrOverallProgress = totalRegions > 0 ? (ocrDoneTotal + ocrFailedTotal) / totalRegions : 0;
  const translateOverallProgress = totalRegions > 0 ? (translateDoneTotal + translateFailedTotal) / totalRegions : 0;

  const togglePage = (pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Пайплайн страниц
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <ScanTextIcon size={11} />
            <span className="flex-1">OCR</span>
            <span className="text-zinc-500">
              {ocrDoneTotal + ocrFailedTotal}/{totalRegions}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.max(2, ocrOverallProgress * 100)}%` }}
            />
          </div>
          <div className="flex gap-2 text-[9px] text-zinc-600">
            <span>{ocrDoneTotal} готово</span>
            {ocrIdleTotal > 0 && <span>{ocrIdleTotal} ожидают</span>}
            {ocrQueuedTotal > 0 && <span>{ocrQueuedTotal} в очереди</span>}
            {ocrFailedTotal > 0 && <span className="text-amber-400">{ocrFailedTotal} ошибок</span>}
          </div>
        </div>

        <div className="mb-2 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <LanguagesIcon size={11} />
            <span className="flex-1">Перевод</span>
            <span className="text-zinc-500">
              {translateDoneTotal + translateFailedTotal}/{totalRegions}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(2, translateOverallProgress * 100)}%` }}
            />
          </div>
          <div className="flex gap-2 text-[9px] text-zinc-600">
            <span>{translateDoneTotal} готово</span>
            {translateIdleTotal > 0 && <span>{translateIdleTotal} ожидают</span>}
            {translateFailedTotal > 0 && <span className="text-amber-400">{translateFailedTotal} ошибок</span>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
        {pageStats.map(({ page, ocrCounts, translateCounts, ocrProgress, translateProgress, failedOcr, failedTranslate }) => {
          const expanded = expandedPages.has(page.id);
          const isActive = page.id === activePageId;
          return (
            <div key={page.id}>
              <button
                onClick={() => {
                  setActivePage(page.id);
                  togglePage(page.id);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-900 ${
                  isActive ? 'bg-indigo-500/5' : ''
                }`}
              >
                <ChevronDownIcon
                  size={10}
                  className={`shrink-0 text-zinc-600 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-200">
                  {page.fileName}
                </span>
                <span className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <ScanTextIcon size={9} />
                  {Math.round(ocrProgress * 100)}%
                </span>
                <span className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <LanguagesIcon size={9} />
                  {Math.round(translateProgress * 100)}%
                </span>
              </button>

              {expanded && (
                <div className="border-t border-zinc-800/50 px-3 py-2">
                  <div className="mb-2 space-y-1">
                    <div className="flex items-center gap-2 text-[10px]">
                      <ScanTextIcon size={10} className="text-indigo-400" />
                      <span className="flex-1 text-zinc-400">OCR</span>
                      <span className="text-zinc-500">
                        {ocrCounts.done + ocrCounts.failed}/{ocrCounts.idle + ocrCounts.queued + ocrCounts.running + ocrCounts.done + ocrCounts.failed}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.max(2, ocrProgress * 100)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[9px] text-zinc-600">
                      {ocrCounts.done > 0 && <span>готово: {ocrCounts.done}</span>}
                      {ocrCounts.idle > 0 && <span>ожидают: {ocrCounts.idle}</span>}
                      {ocrCounts.failed > 0 && <span className="text-amber-400">ошибок: {ocrCounts.failed}</span>}
                    </div>
                  </div>

                  <div className="mb-2 space-y-1">
                    <div className="flex items-center gap-2 text-[10px]">
                      <LanguagesIcon size={10} className="text-emerald-400" />
                      <span className="flex-1 text-zinc-400">Перевод</span>
                      <span className="text-zinc-500">
                        {translateCounts.done + translateCounts.failed}/{translateCounts.idle + translateCounts.queued + translateCounts.running + translateCounts.done + translateCounts.failed}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(2, translateProgress * 100)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[9px] text-zinc-600">
                      {translateCounts.done > 0 && <span>готово: {translateCounts.done}</span>}
                      {translateCounts.idle > 0 && <span>ожидают: {translateCounts.idle}</span>}
                      {translateCounts.failed > 0 && <span className="text-amber-400">ошибок: {translateCounts.failed}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {ocrCounts.failed > 0 && (
                      <button
                        onClick={() => {
                          const failedRegionIds = (page.regions ?? [])
                            .filter((r) => r.ocrStatus === 'failed')
                            .map((r) => r.id);
                          cancelOcrJobs(page.id, failedRegionIds);
                          queueOcrJobs([{ pageId: page.id, regionIds: failedRegionIds }]);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        <RotateCcw size={8} />
                        OCR
                      </button>
                    )}
                    {translateCounts.failed > 0 && (
                      <button
                        onClick={() => {
                          const failedRegionIds = (page.regions ?? [])
                            .filter((r) => r.translationStatus === 'failed')
                            .map((r) => r.id);
                          queueTranslationJobs([{ pageId: page.id, regionIds: failedRegionIds }]);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        <RotateCcw size={8} />
                        Перевод
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
