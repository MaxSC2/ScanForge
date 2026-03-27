import type { JobRecord, JobResultReason, JobResultSummary, JobStatus, OcrPageResult } from '../types';

const OCR_SKIP_REASONS = new Set(['locked', 'already_filled']);

function normalizeReasonLabel(reason: string) {
  switch (reason) {
    case 'already_filled':
      return 'already filled';
    case 'invalid_bounds':
      return 'invalid bounds';
    case 'no_text':
      return 'no text';
    default:
      return reason.replace(/_/g, ' ');
  }
}

function sortReasons(reasons: JobResultReason[]) {
  return reasons.slice().sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.reason.localeCompare(right.reason);
  });
}

export function summarizeOcrPageResult(result: OcrPageResult): JobResultSummary {
  const reasonCounts = new Map<string, number>();

  for (const item of result.results) {
    if (!item.skipped || !item.reason) {
      continue;
    }

    reasonCounts.set(item.reason, (reasonCounts.get(item.reason) ?? 0) + 1);
  }

  const reasons = sortReasons(
    Array.from(reasonCounts.entries()).map(([reason, count]) => ({
      reason,
      count,
      kind: OCR_SKIP_REASONS.has(reason) ? ('skip' as const) : ('failure' as const),
    })),
  );
  const failedCount = reasons
    .filter((reason) => reason.kind === 'failure')
    .reduce((total, reason) => total + reason.count, 0);

  return {
    provider: result.engine,
    regionsProcessed: result.regionsProcessed,
    appliedCount: result.filledCount,
    skippedCount: result.skippedCount,
    failedCount,
    ...(reasons.length > 0 ? { reasons } : {}),
  };
}

export function formatJobResultSummary(stage: JobRecord['stage'], result: JobResultSummary) {
  const action = stage === 'ocr' ? 'applied' : 'translated';
  const parts = [`${result.provider}: ${action} ${result.appliedCount}/${result.regionsProcessed}`];

  if (result.failedCount > 0) {
    parts.push(`failed ${result.failedCount}`);
  }

  if (result.skippedCount > 0) {
    parts.push(`skipped ${result.skippedCount}`);
  }

  if (result.reasons?.length) {
    const detail = result.reasons
      .map((reason) => `${normalizeReasonLabel(reason.reason)} x${reason.count}`)
      .join(', ');
    parts.push(`(${detail})`);
  }

  return parts.join(', ');
}

export function deriveOcrJobOutcome(result: JobResultSummary): {
  status: JobStatus;
  error: string | null;
  message: string;
} {
  const message = formatJobResultSummary('ocr', result);

  if (result.failedCount > 0 && result.appliedCount === 0) {
    return {
      status: 'failed',
      error: message,
      message,
    };
  }

  return {
    status: 'done',
    error: null,
    message,
  };
}
