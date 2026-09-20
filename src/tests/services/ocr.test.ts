import { beforeEach, describe, expect, it, vi } from 'vitest';

const pageRepositoryMock = {
  getById: vi.fn(),
};

const regionRepositoryMock = {
  getByPage: vi.fn(),
  update: vi.fn(),
};

const ensureProjectDomainDefaultsMock = vi.fn();

vi.mock('../../repositories/pageRepository', () => ({
  pageRepository: pageRepositoryMock,
}));

vi.mock('../../repositories/regionRepository', () => ({
  regionRepository: regionRepositoryMock,
}));

vi.mock('../../repositories/projectDefaults', () => ({
  ensureProjectDomainDefaults: ensureProjectDomainDefaultsMock,
}));

vi.mock('../../utils/runtime', () => ({
  isDesktopRuntime: vi.fn(() => false),
}));

vi.mock('../../stores/useDiagnosticsStore', () => ({
  useDiagnosticsStore: {
    getState: () => ({ record: vi.fn() }),
  },
}));

import {
  computeAverageConfidence,
  resolveTesseractLanguage,
  runPageOcr,
} from '../../services/ocr';
import { isDesktopRuntime } from '../../utils/runtime';

describe('OCR service contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveTesseractLanguage', () => {
    it('maps supported source languages to Tesseract models', () => {
      expect(resolveTesseractLanguage('ja')).toBe('jpn');
      expect(resolveTesseractLanguage('zh')).toBe('chi_sim');
      expect(resolveTesseractLanguage('ko')).toBe('kor');
      expect(resolveTesseractLanguage('en')).toBe('eng');
    });

    it('uses English as fallback for auto and unknown languages', () => {
      expect(resolveTesseractLanguage('auto')).toBe('eng');
      expect(resolveTesseractLanguage('xx')).toBe('eng');
      expect(resolveTesseractLanguage()).toBe('eng');
    });
  });

  describe('computeAverageConfidence', () => {
    it('ignores skipped results and returns a rounded mean', () => {
      expect(
        computeAverageConfidence([
          { regionId: 'r1', text: 'hello', confidence: 0.951, skipped: false, reason: null },
          { regionId: 'r2', text: 'world', confidence: 0.849, skipped: false, reason: null },
          { regionId: 'r3', text: null, confidence: 0.1, skipped: true, reason: 'locked' },
        ]),
      ).toBe(0.9);
    });

    it('returns undefined when no usable confidence exists', () => {
      expect(computeAverageConfidence([])).toBeUndefined();
      expect(
        computeAverageConfidence([
          { regionId: 'r1', text: null, confidence: undefined, skipped: true, reason: 'locked' },
        ]),
      ).toBeUndefined();
    });
  });

  it('rejects a browser OCR configuration that is not executable in browser runtime', async () => {
    vi.mocked(isDesktopRuntime).mockReturnValue(false);
    pageRepositoryMock.getById.mockResolvedValue({
      id: 'page-1',
      projectId: 'project-1',
      imagePath: 'data:image/png;base64,AAAA',
      width: 800,
      height: 1200,
    });
    regionRepositoryMock.getByPage.mockResolvedValue([
      {
        id: 'region-1',
        pageId: 'page-1',
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        order: 1,
        label: 'R1',
        kind: 'speech',
        orientation: 'horizontal',
        sourceText: '',
        translatedText: '',
        status: 'idle',
        ocrStatus: 'idle',
        translationStatus: 'idle',
        notes: '',
        locked: false,
        visible: true,
      },
    ]);
    ensureProjectDomainDefaultsMock.mockResolvedValue({
      sourceLanguage: 'ja',
      targetLanguage: 'ru',
      ocrEngine: 'windows',
      translationProvider: 'local',
    });

    await expect(
      runPageOcr(
        {
          id: 'page-1',
          fileName: 'page-1.png',
          imagePath: 'data:image/png;base64,AAAA',
          imageUrl: 'data:image/png;base64,AAAA',
          naturalWidth: 800,
          naturalHeight: 1200,
          regions: [],
        },
        {},
      ),
    ).rejects.toThrow('not supported in browser runtime');
  });

  it('rejects an OCR job before touching runtime-specific providers when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runPageOcr(
        {
          id: 'page-1',
          fileName: 'page-1.png',
          imagePath: 'data:image/png;base64,AAAA',
          imageUrl: 'data:image/png;base64,AAAA',
          naturalWidth: 800,
          naturalHeight: 1200,
          regions: [],
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });

    expect(pageRepositoryMock.getById).not.toHaveBeenCalled();
  });
});
