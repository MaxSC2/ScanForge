import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computeAverageConfidence } from '../../services/ocr';

// Helper functions from ocr.ts — tested via their behavior
// We test the publicly observable behavior through runBrowserPreviewOcr
// and pure helper logic

describe('OCR service helpers', () => {
  describe('computeAverageConfidence', () => {
    it('returns undefined for empty results', () => {
      expect(computeAverageConfidence([])).toBeUndefined();
    });

    it('returns undefined when all results are skipped', () => {
      expect(
        computeAverageConfidence([
          { regionId: 'r1', text: null, confidence: undefined, skipped: true, reason: 'locked' },
          { regionId: 'r2', text: null, confidence: undefined, skipped: true, reason: 'already_filled' },
        ]),
      ).toBeUndefined();
    });

    it('computes average of non-skipped results with confidence', () => {
      const result = computeAverageConfidence([
        { regionId: 'r1', text: 'hello', confidence: 0.95, skipped: false, reason: null },
        { regionId: 'r2', text: 'world', confidence: 0.85, skipped: false, reason: null },
        { regionId: 'r3', text: null, confidence: 0.5, skipped: true, reason: 'locked' },
      ]);
      expect(result).toBe(0.9);
    });

    it('handles single result with confidence', () => {
      expect(
        computeAverageConfidence([
          { regionId: 'r1', text: 'test', confidence: 0.75, skipped: false, reason: null },
        ]),
      ).toBe(0.75);
    });

    it('ignores results with null confidence', () => {
      expect(
        computeAverageConfidence([
          { regionId: 'r1', text: 'a', confidence: null, skipped: false, reason: null },
          { regionId: 'r2', text: 'b', confidence: 0.9, skipped: false, reason: null },
        ]),
      ).toBe(0.9);
    });
  });
});

describe('runPageOcr', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const { runPageOcr } = await import('../../services/ocr');

    await expect(
      runPageOcr(
        { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 200, regions: [] } as any,
        { signal: controller.signal },
      ),
    ).rejects.toThrow('aborted');
  });

  it('runs browser preview when not in desktop runtime', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1',
          projectId: 'prj1',
          imagePath: 'data:image/png;base64,abc',
          width: 100,
          height: 200,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: 'bubble 1', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'ja',
        ocrEngine: 'mock',
        targetLanguage: 'ru',
        translationProvider: 'local',
      }),
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 200, regions: [{ id: 'r1', x: 0, y: 0, width: 50, height: 30, label: 'bubble 1', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true }] } as any,
      {},
    );

    expect(result.engine).toBe('scanforge-preview');
    expect(result.regionsProcessed).toBe(1);
    expect(result.filledCount).toBe(1);
    expect(result.results[0].text).toContain('OCR preview');
    expect(result.results[0].skipped).toBe(false);
  });

  it('skips locked regions during browser preview', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: true, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'auto', ocrEngine: 'mock', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    vi.mock('../../stores/useDiagnosticsStore', () => ({
      useDiagnosticsStore: { getState: () => ({ record: vi.fn() }) },
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [{ id: 'r1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: true, visible: true }] } as any,
      {},
    );

    expect(result.skippedCount).toBe(1);
    expect(result.filledCount).toBe(0);
    expect(result.results[0].reason).toBe('locked');
  });

  it('skips already_filled regions when overwrite is disabled', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: 'existing text', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'auto', ocrEngine: 'mock', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [{ id: 'r1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: 'existing text', ocrStatus: 'done', locked: false, visible: true }] } as any,
      { overwriteExisting: false },
    );

    expect(result.skippedCount).toBe(1);
    expect(result.filledCount).toBe(0);
    expect(result.results[0].reason).toBe('already_filled');
  });

  it('uses correct provider path for tesseract engine in preview', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'auto', ocrEngine: 'tesseract', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    vi.mock('../../stores/useDiagnosticsStore', () => ({
      useDiagnosticsStore: { getState: () => ({ record: vi.fn() }) },
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [{ id: 'r1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true }] } as any,
      {},
    );

    expect(result.engine).toBe('scanforge-tesseract-preview');
    expect(result.providerPath).toEqual(['tesseract', 'scanforge-tesseract-preview']);
  });

  it('uses correct provider path for manga-ocr engine in preview', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'ja', ocrEngine: 'manga-ocr', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    vi.mock('../../stores/useDiagnosticsStore', () => ({
      useDiagnosticsStore: { getState: () => ({ record: vi.fn() }) },
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [{ id: 'r1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true }] } as any,
      {},
    );

    expect(result.engine).toBe('scanforge-manga-ocr-preview');
    expect(result.providerPath).toEqual(['manga-ocr', 'scanforge-manga-ocr-preview']);
  });

  it('uses correct provider path for paddle engine in preview', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'ja', ocrEngine: 'paddle', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    vi.mock('../../stores/useDiagnosticsStore', () => ({
      useDiagnosticsStore: { getState: () => ({ record: vi.fn() }) },
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [{ id: 'r1', x: 0, y: 0, width: 50, height: 30, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true }] } as any,
      {},
    );

    expect(result.engine).toBe('scanforge-paddle-preview');
    expect(result.providerPath).toEqual(['paddle', 'scanforge-paddle-preview']);
  });

  it('rejects OCR with zero-area regions and reports invalid_bounds', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 0, height: 0, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'auto', ocrEngine: 'mock', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    vi.mock('../../stores/useDiagnosticsStore', () => ({
      useDiagnosticsStore: { getState: () => ({ record: vi.fn() }) },
    }));

    const { runPageOcr } = await import('../../services/ocr');

    const result = await runPageOcr(
      { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [{ id: 'r1', x: 0, y: 0, width: 0, height: 0, label: '', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true }] } as any,
      {},
    );

    expect(result.skippedCount).toBe(1);
    expect(result.filledCount).toBe(0);
    expect(result.results[0].reason).toBe('invalid_bounds');
  });

  it('throws when no regions are provided for OCR', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 100,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([]),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'auto', ocrEngine: 'mock', targetLanguage: 'ru', translationProvider: 'mock',
      }),
    }));

    const { runPageOcr } = await import('../../services/ocr');

    await expect(
      runPageOcr(
        { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 100, regions: [] } as any,
        {},
      ),
    ).rejects.toThrow('No regions selected for OCR');
  });

  it('handles abort between region processing steps', async () => {
    vi.mock('../../utils/runtime', () => ({
      isDesktopRuntime: () => false,
    }));

    vi.mock('../../repositories/pageRepository', () => ({
      pageRepository: {
        getById: vi.fn().mockResolvedValue({
          id: 'p1', projectId: 'prj1', imagePath: 'data:image/png;base64,abc',
          width: 100, height: 200,
        }),
      },
    }));

    vi.mock('../../repositories/regionRepository', () => ({
      regionRepository: {
        getByPage: vi.fn().mockResolvedValue([
          { id: 'r1', pageId: 'p1', x: 0, y: 0, width: 50, height: 30, label: 'bubble 1', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
          { id: 'r2', pageId: 'p1', x: 60, y: 0, width: 40, height: 30, label: 'bubble 2', order: 2, kind: 'text', orientation: 'horizontal', sourceText: '', locked: false, visible: true },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../repositories/projectDefaults', () => ({
      ensureProjectDomainDefaults: vi.fn().mockResolvedValue({
        sourceLanguage: 'ja', ocrEngine: 'mock', targetLanguage: 'ru', translationProvider: 'local',
      }),
    }));

    vi.mock('../../stores/useDiagnosticsStore', () => ({
      useDiagnosticsStore: { getState: () => ({ record: vi.fn() }) },
    }));

    const controller = new AbortController();
    const { runPageOcr } = await import('../../services/ocr');

    setTimeout(() => controller.abort(), 50);

    await expect(
      runPageOcr(
        { id: 'p1', fileName: 'test.png', naturalWidth: 100, naturalHeight: 200, regions: [
          { id: 'r1', x: 0, y: 0, width: 50, height: 30, label: 'bubble 1', order: 1, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true },
          { id: 'r2', x: 60, y: 0, width: 40, height: 30, label: 'bubble 2', order: 2, kind: 'text', orientation: 'horizontal', sourceText: '', ocrStatus: 'idle', locked: false, visible: true },
        ] } as any,
        { signal: controller.signal },
      ),
    ).rejects.toThrow('aborted');
  });
});
