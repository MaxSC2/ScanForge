import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  mergeJobsWithRepository,
  syncJobsForProject,
} from '../repositories';
import { pickRenderedPageExportPath } from '../features/export/renderExport';
import { ensureProjectDomainStatePersisted } from '../services/projectSync';
import {
  persistTranslationTargets,
  recordExportSelectionCanceled,
  runQueuedJob,
  updateTranslationTargetsInEditor,
} from '../services/jobExecution';
import type { JobRecord } from '../types';
import { useDiagnosticsStore } from './useDiagnosticsStore';
import { usePageStore } from './usePageStore';
import { useProjectStore } from './useProjectStore';
import { useToastStore } from './useToastStore';
import { isDesktopRuntime } from '../utils/runtime';

const MAX_JOBS = 30;

interface OcrJobTarget {
  pageId: string;
  regionIds?: string[];
}

interface TranslationJobTarget {
  pageId: string;
  regionIds?: string[];
}

interface ExportJobTarget {
  pageId: string;
  outputPath?: string;
}

interface JobState {
  jobs: JobRecord[];
  processing: boolean;
  queueOcrJobs: (targets: OcrJobTarget[]) => number;
  queueTranslationJobs: (targets: TranslationJobTarget[]) => number;
  queueExportJobs: (targets: ExportJobTarget[]) => number;
  requestExportForPage: (pageId: string) => Promise<number>;
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

async function pumpQueue() {
  const currentState = useJobStore.getState();
  if (currentState.processing) return;

  useJobStore.setState({ processing: true });

  try {
    while (true) {
      const nextJob = useJobStore.getState().jobs.find((job) => job.status === 'queued');
      if (!nextJob) break;
      await runQueuedJob(nextJob, { updateJob });
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

function buildExportJobSignature(pageId: string) {
  return pageId;
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

    for (const job of newJobs) {
      updateTranslationTargetsInEditor(job.pageId, job.regionIds, () => ({
        translationStatus: 'queued',
      }));
      void persistTranslationTargets(job.pageId);
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

  queueExportJobs: (targets) => {
    const normalizedTargets = targets.filter((target) => target.pageId);
    const activeSignatures = new Set(
      get()
        .jobs.filter(
          (job) => job.stage === 'export' && (job.status === 'queued' || job.status === 'running'),
        )
        .map((job) => buildExportJobSignature(job.pageId)),
    );
    const pagesById = new Map(
      usePageStore.getState().pages.map((page) => [page.id, page] as const),
    );
    const filteredTargets = normalizedTargets.filter(
      (target) => !activeSignatures.has(buildExportJobSignature(target.pageId)),
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
          stage: 'export' as const,
          status: 'queued' as const,
          pageId: target.pageId,
          pageName: page.fileName,
          ...(target.outputPath ? { outputPath: target.outputPath } : {}),
          createdAt: createdAt + index,
          startedAt: null,
          finishedAt: null,
          progress: 0,
          message: 'Queued for rendered export',
          error: null,
          result: null,
        };
      })
      .filter((job): job is JobRecord => job !== null);

    if (newJobs.length === 0) {
      return 0;
    }

    setJobsAndPersist((jobs) => [...newJobs, ...jobs]);

    useToastStore.getState().push(`Export jobs queued: ${newJobs.length}`, 'info');
    void pumpQueue();
    return newJobs.length;
  },

  requestExportForPage: async (pageId) => {
    const page = usePageStore.getState().pages.find((item) => item.id === pageId);
    if (!page) {
      useDiagnosticsStore.getState().record({
        scope: 'export',
        level: 'error',
        message: 'Rendered export could not start',
        detail: 'Page not found before queueing export job',
        ...(useProjectStore.getState().meta.localProjectId
          ? { projectId: useProjectStore.getState().meta.localProjectId }
          : {}),
        pageId,
      });
      useToastStore.getState().push('Не удалось запустить экспорт: страница не найдена', 'error');
      return 0;
    }

    const outputPath = await pickRenderedPageExportPath(page);
    if (!outputPath && isDesktopRuntime()) {
      recordExportSelectionCanceled(page.id, page.fileName);
      return 0;
    }

    const queued = get().queueExportJobs([
      {
        pageId: page.id,
        ...(outputPath ? { outputPath } : {}),
      },
    ]);

    if (queued === 0) {
      useToastStore
        .getState()
        .push('Экспорт уже стоит в очереди для этой страницы', 'warning');
    }

    return queued;
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

    if (job.stage === 'export') {
      void (async () => {
        await get().requestExportForPage(job.pageId);
      })();
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
