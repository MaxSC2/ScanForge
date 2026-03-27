import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_MERGE_WINDOW_MS,
  createDiagnosticEntry,
  formatDiagnosticError,
  shouldMergeDiagnostic,
} from '../../services/diagnostics';
import type { DiagnosticInput } from '../../types';

describe('diagnostics', () => {
  it('formats common error shapes', () => {
    expect(formatDiagnosticError(new Error('Boom'))).toBe('Boom');
    expect(formatDiagnosticError('  failed to save  ')).toBe('failed to save');
    expect(formatDiagnosticError({ message: 'bad state' })).toBe('bad state');
    expect(formatDiagnosticError(null, 'fallback')).toBe('fallback');
  });

  it('merges matching diagnostics inside the merge window', () => {
    const input: DiagnosticInput = {
      scope: 'ocr',
      level: 'warning',
      message: 'OCR completed with issues',
      detail: 'windows-winrt: applied 1/3, failed 1',
      pageId: 'page-1',
      jobId: 'job-1',
    };
    const previous = createDiagnosticEntry('diag-1', input, 1_000);

    expect(
      shouldMergeDiagnostic(previous, input, 1_000 + DIAGNOSTIC_MERGE_WINDOW_MS - 1),
    ).toBe(true);
    expect(
      shouldMergeDiagnostic(previous, { ...input, detail: 'other detail' }, 1_500),
    ).toBe(false);
  });
});
