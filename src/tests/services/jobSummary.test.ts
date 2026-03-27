import { describe, expect, it } from 'vitest';
import {
  deriveOcrJobOutcome,
  formatJobResultSummary,
  summarizeOcrPageResult,
} from '../../services/jobSummary';
import type { OcrPageResult } from '../../types';

describe('jobSummary', () => {
  it('aggregates OCR skip and failure reasons', () => {
    const result: OcrPageResult = {
      engine: 'windows-winrt',
      regionsProcessed: 4,
      filledCount: 1,
      skippedCount: 3,
      results: [
        { regionId: 'r1', text: 'hello', skipped: false, reason: null },
        { regionId: 'r2', text: null, skipped: true, reason: 'no_text' },
        { regionId: 'r3', text: null, skipped: true, reason: 'already_filled' },
        { regionId: 'r4', text: null, skipped: true, reason: 'no_text' },
      ],
    };

    const summary = summarizeOcrPageResult(result);

    expect(summary.provider).toBe('windows-winrt');
    expect(summary.appliedCount).toBe(1);
    expect(summary.skippedCount).toBe(3);
    expect(summary.failedCount).toBe(2);
    expect(summary.reasons).toEqual([
      { reason: 'no_text', count: 2, kind: 'failure' },
      { reason: 'already_filled', count: 1, kind: 'skip' },
    ]);
  });

  it('formats readable job summary details', () => {
    const message = formatJobResultSummary('ocr', {
      provider: 'windows-winrt',
      regionsProcessed: 3,
      appliedCount: 1,
      skippedCount: 2,
      failedCount: 1,
      reasons: [
        { reason: 'no_text', count: 1, kind: 'failure' },
        { reason: 'already_filled', count: 1, kind: 'skip' },
      ],
    });

    expect(message).toContain('windows-winrt: applied 1/3');
    expect(message).toContain('failed 1');
    expect(message).toContain('skipped 2');
    expect(message).toContain('no text x1');
    expect(message).toContain('already filled x1');
  });

  it('marks OCR job as failed when nothing usable was applied and failures remain', () => {
    const outcome = deriveOcrJobOutcome({
      provider: 'windows-winrt',
      regionsProcessed: 2,
      appliedCount: 0,
      skippedCount: 2,
      failedCount: 2,
      reasons: [{ reason: 'no_text', count: 2, kind: 'failure' }],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('failed 2');
  });
});
