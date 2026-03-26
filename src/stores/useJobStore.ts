import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { JobRecord, JobResultSummary, Page, Region } from '../types';
import { useHistoryStore } from './useHistoryStore';
import { usePageStore } from './usePageStore';
import { useProjectStore } from './useProjectStore';
import { useToastStore } from './useToastStore';

const MAX_JOBS = 30;
const OCR_REGION_DELAY_MS = 120;

interface JobState {
  jobs: JobRecord[];
  processing: boolean;
  queueOcrJobs: (pageIds: string[]) => number;
  retryJob: (jobId: string) => void;
  clearFinished: () => void;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function summarizeResult(result: JobResultSummary) {
  return `Распознано ${result.filledCount}/${result.regionsProcessed}, пропущено ${result.skippedCount}`;
}

function synthesizeOcrText(page: Page, region: Region) {
  const pageStem = page.fileName.replace(/\.[^.]+$/, '');
  const kindLabel =
    region.kind === 'speech'
      ? 'реплика'
      : region.kind === 'sfx'
        ? 'sfx'
        : region.kind === 'narration'
          ? 'нарратив'
          : 'текст';

  return `[Mock OCR] ${pageStem} · ${kindLabel} ${region.order}`;
}

function updateJob(jobId: string, patch: Partial<JobRecord>) {
  useJobStore.setState((state) => ({
    jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
  }));
}

function applyOcrResult(pageId: string, fillMap: Map<string, string>) {
  if (fillMap.size === 0) return;

  useHistoryStore.getState().capture();
  usePageStore.setState((state) => ({
    pages: state.pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            regions: page.regions.map((region) =>
              fillMap.has(region.id)
                ? { ...region, sourceText: fillMap.get(region.id) ?? region.sourceText }
                : region,
            ),
          }
        : page,
    ),
  }));
  useProjectStore.getState().touch();
}

async function runOcrJob(job: JobRecord) {
  updateJob(job.id, {
    status: 'running',
    startedAt: Date.now(),
    progress: 0.05,
    message: 'Подготовка OCR',
    error: null,
    result: null,
  });

  const page = usePageStore.getState().pages.find((item) => item.id === job.pageId);
  if (!page) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'Страница не найдена',
      message: 'OCR не выполнен',
    });
    return;
  }

  if (page.regions.length === 0) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'На странице нет регионов для OCR',
      message: 'Нет регионов для распознавания',
    });
    return;
  }

  const fillMap = new Map<string, string>();
  let filledCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < page.regions.length; index += 1) {
    const region = page.regions[index];
    await wait(OCR_REGION_DELAY_MS);

    if (region.locked || region.sourceText.trim()) {
      skippedCount += 1;
    } else {
      fillMap.set(region.id, synthesizeOcrText(page, region));
      filledCount += 1;
    }

    updateJob(job.id, {
      progress: (index + 1) / page.regions.length,
      message: `OCR: регион ${index + 1}/${page.regions.length}`,
    });
  }

  applyOcrResult(page.id, fillMap);

  const result: JobResultSummary = {
    regionsProcessed: page.regions.length,
    filledCount,
    skippedCount,
  };

  updateJob(job.id, {
    status: 'done',
    finishedAt: Date.now(),
    progress: 1,
    result,
    message: summarizeResult(result),
  });
}

async function pumpQueue() {
  const currentState = useJobStore.getState();
  if (currentState.processing) return;

  useJobStore.setState({ processing: true });

  try {
    while (true) {
      const nextJob = useJobStore.getState().jobs.find((job) => job.status === 'queued');
      if (!nextJob) break;
      await runOcrJob(nextJob);
    }
  } finally {
    useJobStore.setState({ processing: false });
  }
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  processing: false,

  queueOcrJobs: (pageIds) => {
    const uniqueIds = Array.from(new Set(pageIds));
    const activePageJobs = new Set(
      get()
        .jobs.filter((job) => job.stage === 'ocr' && (job.status === 'queued' || job.status === 'running'))
        .map((job) => job.pageId),
    );
    const pages = usePageStore
      .getState()
      .pages.filter((page) => uniqueIds.includes(page.id) && !activePageJobs.has(page.id));

    if (pages.length === 0) {
      return 0;
    }

    const createdAt = Date.now();
    const newJobs: JobRecord[] = pages.map((page, index) => ({
      id: uuid(),
      stage: 'ocr',
      status: 'queued',
      pageId: page.id,
      pageName: page.fileName,
      createdAt: createdAt + index,
      startedAt: null,
      finishedAt: null,
      progress: 0,
      message: 'Ожидает запуска OCR',
      error: null,
      result: null,
    }));

    set((state) => ({
      jobs: [...newJobs, ...state.jobs].slice(0, MAX_JOBS),
    }));

    useToastStore
      .getState()
      .push(`OCR jobs в очереди: ${newJobs.length}`, 'info');
    void pumpQueue();
    return newJobs.length;
  },

  retryJob: (jobId) => {
    const job = get().jobs.find((item) => item.id === jobId);
    if (!job) return;
    get().queueOcrJobs([job.pageId]);
  },

  clearFinished: () =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.status === 'queued' || job.status === 'running'),
    })),
}));
