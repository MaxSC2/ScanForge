import { describe, expect, it } from 'vitest';
import {
  deriveOcrJobOutcome,
  deriveTranslationJobOutcome,
  formatJobResultSummary,
  summarizeOcrPageResult,
  summarizeTranslationPageResult,
} from '../../services/jobSummary';
import type { OcrPageResult, TranslationPageResult } from '../../types';

describe('jobSummary', () => {
  it('aggregates OCR skip and failure reasons', () => {
    const result: OcrPageResult = {
      engine: 'windows-winrt',
      providerPath: ['manga-ocr', 'paddle', 'windows-winrt'],
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

    expect(summary.provider).toBe('windows-winrt via manga-ocr -> paddle');
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

  it('summarizes translation fallback path and skip reasons', () => {
    const result: TranslationPageResult = {
      provider: 'scanforge-local-draft',
      providerPath: ['remote', 'local'],
      regionsProcessed: 3,
      translatedCount: 1,
      skippedCount: 2,
      results: [
        { regionId: 'r1', translatedText: 'Привет', skipped: false, reason: null },
        { regionId: 'r2', translatedText: null, skipped: true, reason: 'already_translated' },
        { regionId: 'r3', translatedText: null, skipped: true, reason: 'empty_source' },
      ],
    };

    const summary = summarizeTranslationPageResult(result);

    expect(summary.provider).toBe('scanforge-local-draft via remote');
    expect(summary.appliedCount).toBe(1);
    expect(summary.skippedCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.reasons).toEqual([
      { reason: 'already_translated', count: 1, kind: 'skip' },
      { reason: 'empty_source', count: 1, kind: 'failure' },
    ]);
  });

  it('marks translation job as failed when nothing was translated and failures remain', () => {
    const outcome = deriveTranslationJobOutcome({
      provider: 'scanforge-local-draft via remote',
      regionsProcessed: 2,
      appliedCount: 0,
      skippedCount: 2,
      failedCount: 1,
      reasons: [
        { reason: 'empty_source', count: 1, kind: 'failure' },
        { reason: 'already_translated', count: 1, kind: 'skip' },
      ],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('empty source x1');
  });
});
