import type {
  RenderedExportResult,
  JobRecord,
  JobResultReason,
  JobResultSummary,
  JobStatus,
  OcrPageResult,
  TranslationPageResult,
} from '../types';

const OCR_SKIP_REASONS = new Set(['locked', 'already_filled']);
const TRANSLATION_SKIP_REASONS = new Set(['locked', 'already_translated']);

function normalizeReasonLabel(reason: string) {
  switch (reason) {
    case 'already_filled':
      return 'already filled';
    case 'already_translated':
      return 'already translated';
    case 'empty_source':
      return 'empty source';
    case 'invalid_bounds':
      return 'invalid bounds';
    case 'no_text':
      return 'no text';
    case 'provider_unavailable':
      return 'provider unavailable';
    case 'canceled':
      return 'canceled';
    default:
      return reason.replace(/_/g, ' ');
  }
}

function describeOcrProvider(result: OcrPageResult) {
  if (result.providerPath && result.providerPath.length > 1) {
    return `${result.engine} via ${result.providerPath.slice(0, -1).join(' -> ')}`;
  }

  return result.engine;
}

function describeTranslationProvider(result: TranslationPageResult) {
  if (result.providerPath && result.providerPath.length > 1) {
    return `${result.provider} via ${result.providerPath.slice(0, -1).join(' -> ')}`;
  }

  return result.provider;
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
    provider: describeOcrProvider(result),
    regionsProcessed: result.regionsProcessed,
    appliedCount: result.filledCount,
    skippedCount: result.skippedCount,
    failedCount,
    ...(reasons.length > 0 ? { reasons } : {}),
  };
}

export function summarizeTranslationPageResult(result: TranslationPageResult): JobResultSummary {
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
      kind: TRANSLATION_SKIP_REASONS.has(reason) ? ('skip' as const) : ('failure' as const),
    })),
  );
  const failedCount = reasons
    .filter((reason) => reason.kind === 'failure')
    .reduce((total, reason) => total + reason.count, 0);

  return {
    provider: describeTranslationProvider(result),
    regionsProcessed: result.regionsProcessed,
    appliedCount: result.translatedCount,
    skippedCount: result.skippedCount,
    failedCount,
    ...(reasons.length > 0 ? { reasons } : {}),
  };
}

export function summarizeExportResult(result: RenderedExportResult): JobResultSummary {
  if (result.canceled) {
    return {
      provider: 'rendered-png',
      regionsProcessed: Math.max(1, result.translatedRegions),
      appliedCount: 0,
      skippedCount: 1,
      failedCount: 0,
      ...(result.outputSha256 ? { artifactHash: result.outputSha256 } : {}),
      reasons: [{ reason: 'canceled', count: 1, kind: 'skip' }],
    };
  }

  return {
    provider: 'rendered-png',
    regionsProcessed: result.translatedRegions,
    appliedCount: result.renderedRegions,
    skippedCount: 0,
    failedCount: 0,
    ...(result.outputSha256 ? { artifactHash: result.outputSha256 } : {}),
  };
}

export function formatJobResultSummary(stage: JobRecord['stage'], result: JobResultSummary) {
  const action =
    stage === 'ocr' ? 'applied' : stage === 'translate' ? 'translated' : 'rendered';
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

  if (result.artifactHash) {
    parts.push(`sha256 ${result.artifactHash.slice(0, 8)}`);
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

export function deriveTranslationJobOutcome(result: JobResultSummary): {
  status: JobStatus;
  error: string | null;
  message: string;
} {
  const message = formatJobResultSummary('translate', result);

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

export function deriveExportJobOutcome(result: JobResultSummary): {
  status: JobStatus;
  error: string | null;
  message: string;
} {
  const message = formatJobResultSummary('export', result);

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
