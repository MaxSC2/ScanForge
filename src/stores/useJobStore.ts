import { create } from 'zustand';
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
import {
  buildQueuedJobs,
  buildRetryTarget,
  filterQueueTargets,
  normalizeQueueTargets,
} from '../services/jobQueue';
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

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  processing: false,

  queueOcrJobs: (targets) => {
    const normalizedTargets = normalizeQueueTargets('ocr', targets);
    const pagesById = new Map(
      usePageStore.getState().pages.map((page) => [page.id, page] as const),
    );
    const filteredTargets = filterQueueTargets('ocr', normalizedTargets, get().jobs);

    if (filteredTargets.length === 0) {
      return 0;
    }

    const newJobs = buildQueuedJobs('ocr', filteredTargets, pagesById, Date.now());

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
    const normalizedTargets = normalizeQueueTargets('translate', targets);
    const pagesById = new Map(
      usePageStore.getState().pages.map((page) => [page.id, page] as const),
    );
    const filteredTargets = filterQueueTargets('translate', normalizedTargets, get().jobs);

    if (filteredTargets.length === 0) {
      return 0;
    }

    const newJobs = buildQueuedJobs('translate', filteredTargets, pagesById, Date.now());

    if (newJobs.length === 0) {
      return 0;
    }

    setJobsAndPersist((jobs) => [...newJobs, ...jobs]);

    useToastStore.getState().push(`Translation jobs queued: ${newJobs.length}`, 'info');
    void pumpQueue();
    return newJobs.length;
  },

  queueExportJobs: (targets) => {
    const normalizedTargets = normalizeQueueTargets('export', targets);
    const pagesById = new Map(
      usePageStore.getState().pages.map((page) => [page.id, page] as const),
    );
    const filteredTargets = filterQueueTargets('export', normalizedTargets, get().jobs);

    if (filteredTargets.length === 0) {
      return 0;
    }

    const newJobs = buildQueuedJobs('export', filteredTargets, pagesById, Date.now());

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

    const target = buildRetryTarget(job);

    if (job.stage === 'translate') {
      get().queueTranslationJobs([target]);
      return;
    }

    if (job.stage === 'export') {
      void (async () => {
        await get().requestExportForPage(job.pageId);
      })();
      return;
    }

    get().queueOcrJobs([target]);
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
