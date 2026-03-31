import { mergeRegionsForPage, syncRegionsForPages } from '../repositories';
import { formatDiagnosticError } from './diagnostics';
import {
  deriveExportJobOutcome,
  deriveOcrJobOutcome,
  deriveTranslationJobOutcome as deriveTranslationOutcome,
  formatJobResultSummary,
  summarizeExportFailure,
  summarizeExportResult,
  summarizeOcrPageResult,
  summarizeTranslationPageResult,
} from './jobSummary';
import { exportRenderedPageAsPng } from '../features/export/renderExport';
import { runPageOcr } from './ocr';
import { ensureProjectDomainStatePersisted } from './projectSync';
import { runPageTranslation } from './translation';
import type { JobRecord, JobResultSummary, Region } from '../types';
import { useDiagnosticsStore } from '../stores/useDiagnosticsStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { usePageStore } from '../stores/usePageStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useToastStore } from '../stores/useToastStore';

export interface JobExecutionBindings {
  updateJob: (jobId: string, patch: Partial<JobRecord>) => void;
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

export function recordExportSelectionCanceled(pageId: string, pageName: string) {
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
  useToastStore.getState().push(`Р­РєСЃРїРѕСЂС‚ РѕС‚РјРµРЅС‘РЅ: ${pageName}`, 'info');
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

export function updateTranslationTargetsInEditor(
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

export async function persistTranslationTargets(pageId: string) {
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

async function runOcrJob(job: JobRecord, { updateJob }: JobExecutionBindings) {
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

async function runTranslationJob(job: JobRecord, { updateJob }: JobExecutionBindings) {
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

async function runExportJob(job: JobRecord, { updateJob }: JobExecutionBindings) {
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

export async function runQueuedJob(job: JobRecord, bindings: JobExecutionBindings) {
  if (job.stage === 'ocr') {
    await runOcrJob(job, bindings);
    return;
  }

  if (job.stage === 'translate') {
    await runTranslationJob(job, bindings);
    return;
  }

  await runExportJob(job, bindings);
}
