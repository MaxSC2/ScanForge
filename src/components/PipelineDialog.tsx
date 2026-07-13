import { useState, useEffect, useCallback } from 'react';
import { BotIcon, WorkflowIcon, XIcon } from '../icons';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';
import { useToastStore } from '../stores/useToastStore';
import { ensureProjectDomainStatePersisted } from '../services/projectSync';
import { autoDetectRegions } from '../services/autoDetect';
import { isDesktopRuntime } from '../utils/runtime';
import { mergeRegionsForPage } from '../repositories';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useProjectStore } from '../stores/useProjectStore';

type PipelineMode = 'ocr-translate' | 'full' | 'auto-full';

export function PipelineDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pages = usePageStore((s) => s.pages);
  const jobs = useJobStore((s) => s.jobs);
  const processing = useJobStore((s) => s.processing);
  const pushToast = useToastStore((s) => s.push);
  const [mode, setMode] = useState<PipelineMode>('ocr-translate');
  const [detectRunning, setDetectRunning] = useState(false);
  const [detectProgress, setDetectProgress] = useState(0);
  const [detectMessage, setDetectMessage] = useState('');

  const activeCount = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  const isActive = activeCount > 0 || processing || detectRunning;

  const handleDetectAndQueue = useCallback(async () => {
    const pageIds = pages.map((p) => p.id);
    setDetectRunning(true);
    setDetectProgress(0);
    setDetectMessage('Auto-detect start');

    for (let i = 0; i < pageIds.length; i++) {
      const pid = pageIds[i];
      try {
        const result = await autoDetectRegions(pid, true, (p, msg) => {
          const overall = (i + p) / pageIds.length;
          setDetectProgress(overall);
          setDetectMessage(`[${i + 1}/${pageIds.length}] ${msg}`);
        });

        const page = pages.find((p) => p.id === pid);
        if (page) {
          const merged = await mergeRegionsForPage(page);
          useHistoryStore.getState().capture();
          usePageStore.setState((state) => ({
            pages: state.pages.map((entry) =>
              entry.id === pid ? { ...entry, regions: merged.regions } : entry,
            ),
          }));
          useProjectStore.getState().touch();
        }

        pushToast(`Стр. ${i + 1}: найдено ${result.regionsCreated} текстовых блоков`, 'success');
      } catch (err) {
        pushToast(`Стр. ${i + 1}: ошибка детекции: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    setDetectRunning(false);
    setDetectProgress(1);
    setDetectMessage('Auto-detect complete, starting translate & export');

    const translateTargets = pageIds.map((id) => ({ pageId: id }));
    useJobStore.getState().queueTranslationJobs(translateTargets);

    const exportTargets = pageIds.map((id) => ({ pageId: id }));
    useJobStore.getState().queueExportJobs(exportTargets);
  }, [pages, pushToast]);

  const handleStart = () => {
    if (pages.length === 0) return;
    void ensureProjectDomainStatePersisted();

    if (mode === 'auto-full') {
      void handleDetectAndQueue();
      return;
    }

    const pageIds = pages.map((p) => p.id);
    const ocrTargets = pageIds.map((id) => ({ pageId: id }));
    const translateTargets = pageIds.map((id) => ({ pageId: id }));

    useJobStore.getState().queueOcrJobs(ocrTargets);
    useJobStore.getState().queueTranslationJobs(translateTargets);

    if (mode === 'full') {
      const exportTargets = pageIds.map((id) => ({ pageId: id }));
      useJobStore.getState().queueExportJobs(exportTargets);
    }
  };

  useEffect(() => {
    if (open) {
      setMode('ocr-translate');
      setDetectRunning(false);
      setDetectProgress(0);
      setDetectMessage('');
    }
  }, [open]);

  if (!open) return null;

  const stageLabel: Record<string, string> = {
    ocr: 'OCR',
    translate: 'Перевод',
    export: 'Экспорт',
  };

  const stageColor: Record<string, string> = {
    ocr: 'bg-indigo-500',
    translate: 'bg-emerald-500',
    export: 'bg-amber-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <WorkflowIcon size={16} />
          <span className="text-sm font-semibold text-zinc-200">Пайплайн обработки</span>
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        {isActive ? (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-400">Выполняется {activeCount} задач(а)...</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {jobs.filter((j) => j.status === 'queued' || j.status === 'running').slice(0, 10).map((job) => (
                <div key={job.id} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-2 py-1.5">
                  <div className={`h-2 w-2 rounded-full ${stageColor[job.stage] ?? 'bg-zinc-600'} ${job.status === 'running' ? 'animate-pulse' : ''}`} />
                  <span className="text-[10px] text-zinc-400">{stageLabel[job.stage] ?? job.stage}</span>
                  <span className="text-[10px] text-zinc-600">{job.status === 'running' ? '…' : '⏳'}</span>
                  {job.message && <span className="ml-auto truncate text-[9px] text-zinc-600">{job.message}</span>}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="mt-2 w-full rounded-md bg-zinc-800 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200">
              Свернуть
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500">
              Выбери режим обработки для всех {pages.length} страниц:
            </p>

            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${mode === 'ocr-translate' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}>
              <input
                type="radio"
                name="pipeline-mode"
                checked={mode === 'ocr-translate'}
                onChange={() => setMode('ocr-translate')}
                className="mt-0.5 accent-indigo-500"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-zinc-200">OCR → Перевод</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">Только распознать и перевести текст</div>
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${mode === 'full' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}>
              <input
                type="radio"
                name="pipeline-mode"
                checked={mode === 'full'}
                onChange={() => setMode('full')}
                className="mt-0.5 accent-indigo-500"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-zinc-200">Полный пайплайн</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">OCR → Перевод → Очистка → Экспорт PNG</div>
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${mode === 'auto-full' ? 'border-violet-500/40 bg-violet-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}>
              <input
                type="radio"
                name="pipeline-mode"
                checked={mode === 'auto-full'}
                onChange={() => setMode('auto-full')}
                className="mt-0.5 accent-violet-500"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-zinc-200">AI-детекция → Перевод → Экспорт</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">
                  {isDesktopRuntime()
                    ? 'Авто-поиск текста (PaddleOCR) → Очистка → Экспорт PNG. Регионы НЕ нужны!'
                    : 'Доступно только в Tauri (десктоп)'}
                </div>
              </div>
            </label>

            {detectRunning && (
              <div className="rounded-lg border border-violet-800/40 bg-violet-950/10 p-2">
                <div className="mb-1 flex items-center gap-2 text-[10px] text-violet-300">
                  <BotIcon size={12} />
                  <span>AI детекция: {Math.round(detectProgress * 100)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-violet-950/30">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${detectProgress * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[9px] text-violet-400/70">{detectMessage}</p>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={pages.length === 0 || detectRunning}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500/20 py-2 text-[11px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:opacity-40"
            >
              {mode === 'auto-full' ? <BotIcon size={14} /> : <WorkflowIcon size={14} />}
              {mode === 'auto-full' ? 'AI-детекция + перевод + экспорт' : 'Запустить пайплайн'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
