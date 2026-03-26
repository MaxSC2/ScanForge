import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { mergeRegionsForPage, syncPagesForProject, syncRegionsForPages } from '../repositories';
import { runPageOcr } from '../services/ocr';
import { getProjectRepository } from '../storage';
import type { JobRecord, JobResultSummary } from '../types';
import { useHistoryStore } from './useHistoryStore';
import { usePageStore } from './usePageStore';
import { useProjectStore } from './useProjectStore';
import { useToastStore } from './useToastStore';

const MAX_JOBS = 30;

interface JobState {
  jobs: JobRecord[];
  processing: boolean;
  queueOcrJobs: (pageIds: string[]) => number;
  retryJob: (jobId: string) => void;
  clearFinished: () => void;
}

function summarizeResult(result: JobResultSummary) {
  return `${result.engine}: filled ${result.filledCount}/${result.regionsProcessed}, skipped ${result.skippedCount}`;
}

function updateJob(jobId: string, patch: Partial<JobRecord>) {
  useJobStore.setState((state) => ({
    jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
  }));
}

const projectRepository = getProjectRepository();

async function ensureProjectSyncedForOcr() {
  let meta = useProjectStore.getState().meta;
  if (!meta.localProjectId) {
    const project = await usePageStore.getState().toProjectFile();
    const result = await projectRepository.saveProject(project);
    meta = result.project.meta;
    if (useProjectStore.getState().meta.localProjectId !== meta.localProjectId) {
      useProjectStore.getState().setMeta(meta);
    }
  }

  const current = usePageStore.getState();
  await syncPagesForProject(meta, current.pages);
  await syncRegionsForPages(current.pages);
}

async function refreshPageRegionsFromRepository(pageId: string) {
  const page = usePageStore.getState().pages.find((item) => item.id === pageId);
  if (!page) return;

  const mergedPage = await mergeRegionsForPage(page);
  useHistoryStore.getState().capture();
  usePageStore.setState((state) => ({
    pages: state.pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            regions: mergedPage.regions,
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
    message: 'Preparing OCR job',
    error: null,
    result: null,
  });

  const page = usePageStore.getState().pages.find((item) => item.id === job.pageId);
  if (!page) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'Page not found',
      message: 'OCR job failed',
    });
    return;
  }

  if (page.regions.length === 0) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'No regions on page',
      message: 'OCR skipped: empty page',
    });
    return;
  }

  try {
    await ensureProjectSyncedForOcr();
    const ocrResult = await runPageOcr(page, (progress, message) => {
      updateJob(job.id, { progress, message });
    });
    await refreshPageRegionsFromRepository(page.id);

    const result: JobResultSummary = {
      engine: ocrResult.engine,
      regionsProcessed: ocrResult.regionsProcessed,
      filledCount: ocrResult.filledCount,
      skippedCount: ocrResult.skippedCount,
    };

    updateJob(job.id, {
      status: 'done',
      finishedAt: Date.now(),
      progress: 1,
      result,
      message: summarizeResult(result),
    });
  } catch (error) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: error instanceof Error ? error.message : 'OCR backend error',
      message: 'OCR job failed',
      result: null,
    });
  }
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
      message: 'Queued for OCR',
      error: null,
      result: null,
    }));

    set((state) => ({
      jobs: [...newJobs, ...state.jobs].slice(0, MAX_JOBS),
    }));

    useToastStore.getState().push(`OCR jobs queued: ${newJobs.length}`, 'info');
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
