import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  mergeJobsWithRepository,
  mergeRegionsForPage,
  syncJobsForProject,
} from '../repositories';
import { deriveOcrJobOutcome, formatJobResultSummary, summarizeOcrPageResult } from '../services/jobSummary';
import { runPageOcr } from '../services/ocr';
import { ensureProjectDomainStatePersisted } from '../services/projectSync';
import { runPageTranslation } from '../services/translation';
import type { JobRecord, JobResultSummary } from '../types';
import { useEditorStore } from './useEditorStore';
import { useHistoryStore } from './useHistoryStore';
import { usePageStore } from './usePageStore';
import { useProjectStore } from './useProjectStore';
import { useToastStore } from './useToastStore';

const MAX_JOBS = 30;

interface OcrJobTarget {
  pageId: string;
  regionIds?: string[];
}

interface TranslationJobTarget {
  pageId: string;
  regionIds?: string[];
}

interface JobState {
  jobs: JobRecord[];
  processing: boolean;
  queueOcrJobs: (targets: OcrJobTarget[]) => number;
  queueTranslationJobs: (targets: TranslationJobTarget[]) => number;
  retryJob: (jobId: string) => void;
  clearFinished: () => void;
  loadJobsForCurrentProject: () => Promise<void>;
}

function trimJobs(jobs: JobRecord[]) {
  return jobs
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_JOBS);
}

async function persistCurrentJobs() {
  let meta = useProjectStore.getState().meta;
  if (!meta.localProjectId && useJobStore.getState().jobs.length > 0) {
    meta = await ensureProjectDomainStatePersisted();
  }

  await syncJobsForProject(meta, useJobStore.getState().jobs);
}

function setJobsAndPersist(recipe: (jobs: JobRecord[]) => JobRecord[]) {
  useJobStore.setState((state) => ({
    jobs: trimJobs(recipe(state.jobs)),
  }));
  void persistCurrentJobs();
}

function updateJob(jobId: string, patch: Partial<JobRecord>) {
  setJobsAndPersist((jobs) =>
    jobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
  );
}

async function refreshPageRegionsFromRepository(pageId: string) {
  const page = usePageStore.getState().pages.find((item) => item.id === pageId);
  if (!page) return;

  const mergedPage = await mergeRegionsForPage(page);
  useHistoryStore.getState().capture();
  usePageStore.setState((state) => ({
    pages: state.pages.map((entry) =>
      entry.id === pageId
        ? {
            ...entry,
            regions: mergedPage.regions,
          }
        : entry,
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

  const targetRegions =
    job.regionIds?.length && job.regionIds.length > 0
      ? page.regions.filter((region) => job.regionIds?.includes(region.id))
      : page.regions;

  if (targetRegions.length === 0) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'No regions selected for OCR',
      message: 'OCR skipped: empty selection',
    });
    return;
  }

  try {
    await ensureProjectDomainStatePersisted();
    const overwriteExisting = useEditorStore.getState().ocrOverwrite;
    const ocrResult = await runPageOcr(
      page,
      {
        ...(job.regionIds?.length ? { regionIds: job.regionIds } : {}),
        overwriteExisting,
      },
      (progress, message) => {
        updateJob(job.id, { progress, message });
      },
    );
    await refreshPageRegionsFromRepository(page.id);

    const result = summarizeOcrPageResult(ocrResult);
    const outcome = deriveOcrJobOutcome(result);

    if (result.failedCount > 0 || (result.appliedCount === 0 && result.skippedCount > 0)) {
      console.warn('[ScanForge][OCR] job completed with issues', {
        pageId: page.id,
        regionIds: job.regionIds ?? [],
        result,
      });
    }

    updateJob(job.id, {
      status: outcome.status,
      finishedAt: Date.now(),
      progress: 1,
      result,
      message: outcome.message,
      error: outcome.error,
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

async function runTranslationJob(job: JobRecord) {
  updateJob(job.id, {
    status: 'running',
    startedAt: Date.now(),
    progress: 0.05,
    message: 'Preparing translation job',
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
      message: 'Translation job failed',
    });
    return;
  }

  const targetRegions =
    job.regionIds?.length && job.regionIds.length > 0
      ? page.regions.filter((region) => job.regionIds?.includes(region.id))
      : page.regions;

  if (targetRegions.length === 0) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'No regions selected for translation',
      message: 'Translation skipped: empty selection',
    });
    return;
  }

  try {
    await ensureProjectDomainStatePersisted();
    const overwriteExisting = useEditorStore.getState().translationOverwrite;
    const translationResult = await runPageTranslation(
      page,
      {
        ...(job.regionIds?.length ? { regionIds: job.regionIds } : {}),
        overwriteExisting,
      },
      (progress, message) => {
        updateJob(job.id, { progress, message });
      },
    );
    await refreshPageRegionsFromRepository(page.id);

    const result: JobResultSummary = {
      provider: translationResult.provider,
      regionsProcessed: translationResult.regionsProcessed,
      appliedCount: translationResult.translatedCount,
      skippedCount: translationResult.skippedCount,
      failedCount: 0,
    };

    updateJob(job.id, {
      status: 'done',
      finishedAt: Date.now(),
      progress: 1,
      result,
      message: formatJobResultSummary(job.stage, result),
    });
  } catch (error) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: error instanceof Error ? error.message : 'Translation backend error',
      message: 'Translation job failed',
      result: null,
    });
  }
}

async function runJob(job: JobRecord) {
  if (job.stage === 'ocr') {
    await runOcrJob(job);
    return;
  }

  await runTranslationJob(job);
}

async function pumpQueue() {
  const currentState = useJobStore.getState();
  if (currentState.processing) return;

  useJobStore.setState({ processing: true });

  try {
    while (true) {
      const nextJob = useJobStore.getState().jobs.find((job) => job.status === 'queued');
      if (!nextJob) break;
      await runJob(nextJob);
    }
  } finally {
    useJobStore.setState({ processing: false });
  }
}

function buildTranslationJobSignature(pageId: string, regionIds?: string[]) {
  return `${pageId}:${(regionIds ?? []).slice().sort().join(',')}`;
}

function buildOcrJobSignature(pageId: string, regionIds?: string[]) {
  return `${pageId}:${(regionIds ?? []).slice().sort().join(',')}`;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  processing: false,

  queueOcrJobs: (targets) => {
    const normalizedTargets = targets
      .filter((target) => target.pageId)
      .map((target) => ({
        pageId: target.pageId,
        ...(target.regionIds?.length ? { regionIds: Array.from(new Set(target.regionIds)) } : {}),
      }));
    const activeSignatures = new Set(
      get()
        .jobs.filter(
          (job) => job.stage === 'ocr' && (job.status === 'queued' || job.status === 'running'),
        )
        .map((job) => buildOcrJobSignature(job.pageId, job.regionIds)),
    );
    const pagesById = new Map(
      usePageStore.getState().pages.map((page) => [page.id, page] as const),
    );
    const filteredTargets = normalizedTargets.filter(
      (target) => !activeSignatures.has(buildOcrJobSignature(target.pageId, target.regionIds)),
    );

    if (filteredTargets.length === 0) {
      return 0;
    }

    const createdAt = Date.now();
    const newJobs: JobRecord[] = filteredTargets
      .map((target, index) => {
        const page = pagesById.get(target.pageId);
        if (!page) {
          return null;
        }

        return {
          id: uuid(),
          stage: 'ocr' as const,
          status: 'queued' as const,
          pageId: target.pageId,
          pageName: page.fileName,
          ...(target.regionIds?.length ? { regionIds: target.regionIds } : {}),
          createdAt: createdAt + index,
          startedAt: null,
          finishedAt: null,
          progress: 0,
          message: target.regionIds?.length
            ? `Queued OCR for ${target.regionIds.length} region(s)`
            : 'Queued for OCR',
          error: null,
          result: null,
        };
      })
      .filter((job): job is JobRecord => job !== null);

    if (newJobs.length === 0) {
      return 0;
    }

    setJobsAndPersist((jobs) => [...newJobs, ...jobs]);

    useToastStore.getState().push(`OCR jobs queued: ${newJobs.length}`, 'info');
    void pumpQueue();
    return newJobs.length;
  },

  queueTranslationJobs: (targets) => {
    const normalizedTargets = targets
      .filter((target) => target.pageId)
      .map((target) => ({
        pageId: target.pageId,
        ...(target.regionIds?.length ? { regionIds: Array.from(new Set(target.regionIds)) } : {}),
      }));
    const activeSignatures = new Set(
      get()
        .jobs.filter(
          (job) =>
            job.stage === 'translate' && (job.status === 'queued' || job.status === 'running'),
        )
        .map((job) => buildTranslationJobSignature(job.pageId, job.regionIds)),
    );
    const pagesById = new Map(
      usePageStore.getState().pages.map((page) => [page.id, page] as const),
    );
    const filteredTargets = normalizedTargets.filter(
      (target) => !activeSignatures.has(buildTranslationJobSignature(target.pageId, target.regionIds)),
    );

    if (filteredTargets.length === 0) {
      return 0;
    }

    const createdAt = Date.now();
    const newJobs: JobRecord[] = filteredTargets
      .map((target, index) => {
        const page = pagesById.get(target.pageId);
        if (!page) {
          return null;
        }

        return {
          id: uuid(),
          stage: 'translate' as const,
          status: 'queued' as const,
          pageId: target.pageId,
          pageName: page.fileName,
          ...(target.regionIds?.length ? { regionIds: target.regionIds } : {}),
          createdAt: createdAt + index,
          startedAt: null,
          finishedAt: null,
          progress: 0,
          message: target.regionIds?.length
            ? `Queued translation for ${target.regionIds.length} region(s)`
            : 'Queued for translation',
          error: null,
          result: null,
        };
      })
      .filter((job): job is JobRecord => job !== null);

    if (newJobs.length === 0) {
      return 0;
    }

    setJobsAndPersist((jobs) => [...newJobs, ...jobs]);

    useToastStore.getState().push(`Translation jobs queued: ${newJobs.length}`, 'info');
    void pumpQueue();
    return newJobs.length;
  },

  retryJob: (jobId) => {
    const job = get().jobs.find((item) => item.id === jobId);
    if (!job) return;

    if (job.stage === 'translate') {
      get().queueTranslationJobs([
        {
          pageId: job.pageId,
          ...(job.regionIds?.length ? { regionIds: job.regionIds } : {}),
        },
      ]);
      return;
    }

    get().queueOcrJobs([
      {
        pageId: job.pageId,
        ...(job.regionIds?.length ? { regionIds: job.regionIds } : {}),
      },
    ]);
  },

  clearFinished: () =>
    setJobsAndPersist((jobs) =>
      jobs.filter((job) => job.status === 'queued' || job.status === 'running'),
    ),

  loadJobsForCurrentProject: async () => {
    const meta = useProjectStore.getState().meta;
    const pages = usePageStore.getState().pages;
    const jobs = await mergeJobsWithRepository(meta, pages);

    set({
      jobs: trimJobs(jobs),
      processing: false,
    });

    if (jobs.some((job) => job.status === 'queued')) {
      void pumpQueue();
    }
  },
}));
