import type { DiagnosticEntry, DiagnosticInput } from '../types';

export const DIAGNOSTIC_MERGE_WINDOW_MS = 5_000;

export function formatDiagnosticError(
  error: unknown,
  fallback = 'Unexpected error',
): string {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = String(error.message ?? '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

export function shouldMergeDiagnostic(
  previous: DiagnosticEntry | null | undefined,
  next: DiagnosticInput,
  timestamp = Date.now(),
): boolean {
  if (!previous) {
    return false;
  }

  if (timestamp - previous.timestamp > DIAGNOSTIC_MERGE_WINDOW_MS) {
    return false;
  }

  const nextDetail = next.detail?.trim() || undefined;

  return (
    previous.scope === next.scope &&
    previous.level === next.level &&
    previous.message === next.message &&
    previous.detail === nextDetail &&
    previous.projectId === next.projectId &&
    previous.pageId === next.pageId &&
    previous.regionId === next.regionId &&
    previous.jobId === next.jobId
  );
}

export function createDiagnosticEntry(
  id: string,
  input: DiagnosticInput,
  timestamp = Date.now(),
): DiagnosticEntry {
  const detail = input.detail?.trim() || undefined;

  return {
    id,
    scope: input.scope,
    level: input.level,
    message: input.message,
    timestamp,
    count: 1,
    ...(detail ? { detail } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.pageId ? { pageId: input.pageId } : {}),
    ...(input.regionId ? { regionId: input.regionId } : {}),
    ...(input.jobId ? { jobId: input.jobId } : {}),
  };
}
