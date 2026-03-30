import { create } from 'zustand';
import { isTauri } from '@tauri-apps/api/core';
import { v4 as uuid } from 'uuid';
import {
  mergeJobsWithRepository,
  mergeRegionsForPage,
  syncRegionsForPages,
  syncJobsForProject,
} from '../repositories';
import { formatDiagnosticError } from '../services/diagnostics';
import {
  deriveExportJobOutcome,
  deriveOcrJobOutcome,
  deriveTranslationJobOutcome as deriveTranslationOutcome,
  formatJobResultSummary,
  summarizeExportFailure,
  summarizeExportResult,
  summarizeOcrPageResult,
  summarizeTranslationPageResult,
} from '../services/jobSummary';
import { exportRenderedPageAsPng, pickRenderedPageExportPath } from '../features/export/renderExport';
import { runPageOcr } from '../services/ocr';
import { ensureProjectDomainStatePersisted } from '../services/projectSync';
import { runPageTranslation } from '../services/translation';
import type { JobRecord, JobResultSummary, Region } from '../types';
import { useDiagnosticsStore } from './useDiagnosticsStore';
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

function recordJobDiagnostic(
  job: JobRecord,
  level: 'warning' | 'error',
  message: string,
  detail?: string,
) {
  useDiagnosticsStore.getState().record({
    scope: job.stage === 'ocr' ? 'ocr' : job.stage === 'translate' ? 'translation' : 'export',
    level,
    message,
    ...(detail ? { detail } : {}),
    ...(useProjectStore.getState().meta.localProjectId
      ? { projectId: useProjectStore.getState().meta.localProjectId }
      : {}),
    pageId: job.pageId,
    ...(job.regionIds?.length === 1 ? { regionId: job.regionIds[0] } : {}),
    jobId: job.id,
  });
}

function recordExportSelectionCanceled(pageId: string, pageName: string) {
  useDiagnosticsStore.getState().record({
    scope: 'export',
    level: 'warning',
    message: 'Rendered export target selection canceled',
    detail: 'Canceled before queueing export job',
    ...(useProjectStore.getState().meta.localProjectId
      ? { projectId: useProjectStore.getState().meta.localProjectId }
      : {}),
    pageId,
  });
  useToastStore.getState().push(`Экспорт отменён: ${pageName}`, 'info');
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

function updateTranslationTargetsInEditor(
  pageId: string,
  regionIds: string[] | undefined,
  getPatch: (region: Region) => Partial<Region>,
) {
  const targetIds = regionIds?.length ? new Set(regionIds) : null;

  usePageStore.setState((state) => ({
    pages: state.pages.map((page) => {
      if (page.id !== pageId) {
        return page;
      }

      return {
        ...page,
        regions: page.regions.map((region) => {
          if (targetIds && !targetIds.has(region.id)) {
            return region;
          }

          return {
            ...region,
            ...getPatch(region),
          };
        }),
      };
    }),
  }));
  useProjectStore.getState().touch();
}

async function persistTranslationTargets(pageId: string) {
  const page = usePageStore.getState().pages.find((item) => item.id === pageId);
  if (!page) {
    return;
  }

  const meta = useProjectStore.getState().meta;
  if (!meta.localProjectId) {
    await ensureProjectDomainStatePersisted();
    return;
  }

  await syncRegionsForPages([page]);
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
    recordJobDiagnostic(job, 'error', 'OCR job failed', 'Page not found');
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
    recordJobDiagnostic(
      job,
      'warning',
      'OCR skipped: empty selection',
      'No regions selected for OCR',
    );
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
      recordJobDiagnostic(
        job,
        outcome.status === 'failed' ? 'error' : 'warning',
        outcome.status === 'failed'
          ? 'OCR finished with unresolved failures'
          : 'OCR completed with warnings',
        formatJobResultSummary(job.stage, result),
      );
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
    recordJobDiagnostic(
      job,
      'error',
      'OCR backend failed',
      formatDiagnosticError(error, 'OCR backend error'),
    );
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
    recordJobDiagnostic(job, 'error', 'Translation job failed', 'Page not found');
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
    recordJobDiagnostic(
      job,
      'warning',
      'Translation skipped: empty selection',
      'No regions selected for translation',
    );
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
    updateTranslationTargetsInEditor(page.id, job.regionIds, () => ({
      translationStatus: 'running',
    }));
    await persistTranslationTargets(page.id);
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

    const result: JobResultSummary = summarizeTranslationPageResult(translationResult);
    const outcome = deriveTranslationOutcome(result);

    if (result.failedCount > 0 || (result.appliedCount === 0 && result.skippedCount > 0)) {
      recordJobDiagnostic(
        job,
        outcome.status === 'failed' ? 'error' : 'warning',
        outcome.status === 'failed'
          ? 'Translation finished with unresolved failures'
          : 'Translation completed with warnings',
        formatJobResultSummary(job.stage, result),
      );
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
    const failedAt = Date.now();
    updateTranslationTargetsInEditor(page.id, job.regionIds, (region) => ({
      translationStatus: 'failed',
      status: region.translatedText.trim()
        ? 'translated'
        : region.sourceText.trim()
          ? 'ocr_done'
          : 'idle',
      translationUpdatedAt: failedAt,
    }));
    await persistTranslationTargets(page.id);
    recordJobDiagnostic(
      job,
      'error',
      'Translation backend failed',
      formatDiagnosticError(error, 'Translation backend error'),
    );
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

async function runExportJob(job: JobRecord) {
  updateJob(job.id, {
    status: 'running',
    startedAt: Date.now(),
    progress: 0.2,
    message: 'Preparing rendered export',
    error: null,
    result: null,
  });

  const page = usePageStore.getState().pages.find((item) => item.id === job.pageId);
  if (!page) {
    recordJobDiagnostic(job, 'error', 'Export job failed', 'Page not found');
    updateJob(job.id, {
      status: 'failed',
      finishedAt: Date.now(),
      progress: 1,
      error: 'Page not found',
      message: 'Export job failed',
    });
    return;
  }

  try {
    updateJob(job.id, {
      progress: 0.45,
      message: 'Rendering translated page',
    });

    const exportResult = await exportRenderedPageAsPng(page, {
      ...(job.outputPath ? { outputPath: job.outputPath } : {}),
    });
    const result = summarizeExportResult(exportResult);

    if (exportResult.canceled) {
      recordJobDiagnostic(
        job,
        'warning',
        'Rendered export canceled by user',
        formatJobResultSummary('export', result),
      );
      updateJob(job.id, {
        status: 'done',
        finishedAt: Date.now(),
        progress: 1,
        result,
        message: 'rendered-png: canceled by user',
        error: null,
      });
      return;
    }

    const outcome = deriveExportJobOutcome(result);
    updateJob(job.id, {
      status: outcome.status,
      finishedAt: Date.now(),
      progress: 1,
      result,
      message: outcome.message,
      error: outcome.error,
    });
  } catch (error) {
    const result = summarizeExportFailure(error);
    const outcome = deriveExportJobOutcome(result);
    const errorDetail = formatDiagnosticError(error, 'Rendered export error');

    recordJobDiagnostic(
      job,
      'error',
      'Rendered export failed',
      `${formatJobResultSummary('export', result)} | ${errorDetail}`,
    );
    updateJob(job.id, {
      status: outcome.status,
      finishedAt: Date.now(),
      progress: 1,
      error: errorDetail,
      message: outcome.message,
      result,
    });
  }
}

async function runJob(job: JobRecord) {
  if (job.stage === 'ocr') {
    await runOcrJob(job);
    return;
  }

  if (job.stage === 'translate') {
    await runTranslationJob(job);
    return;
  }

  await runExportJob(job);
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
    if (!outputPath && isTauri()) {
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
