import { describe, expect, it } from 'vitest';
import type { Region } from '../../types';
import { applyRegionLifecyclePatch } from '../../stores/regionLifecyclePolicy';

function createRegion(overrides: Partial<Region> = {}): Region {
  return {
    id: 'region-1',
    label: 'Region 1',
    x: 10,
    y: 20,
    width: 100,
    height: 40,
    rotation: 0,
    orientation: 'horizontal',
    sourceText: '',
    translatedText: '',
    status: 'idle',
    ocrStatus: 'idle',
    translationStatus: 'idle',
    kind: 'speech',
    order: 1,
    notes: '',
    locked: false,
    visible: true,
    ...overrides,
  };
}

describe('regionLifecyclePolicy', () => {
  it('marks manual translated text as done with manual provider metadata', () => {
    const region = createRegion({ sourceText: 'Hello friend', status: 'ocr_done', ocrStatus: 'done' });
    const patch = applyRegionLifecyclePatch(
      region,
      { translatedText: 'Привет, друг' },
      1234,
    );

    expect(patch).toEqual({
      translationStatus: 'done',
      translationProvider: 'manual',
      translationUpdatedAt: 1234,
      status: 'translated',
    });
  });

  it('clearing translated text restores pre-translation lifecycle', () => {
    const region = createRegion({
      sourceText: 'Hello friend',
      translatedText: 'Привет, друг',
      status: 'translated',
      ocrStatus: 'done',
      translationStatus: 'done',
      translationProvider: 'scanforge-local-draft',
      translationUpdatedAt: 1111,
    });
    const patch = applyRegionLifecyclePatch(region, { translatedText: '' }, 2222);

    expect(patch.translationStatus).toBe('idle');
    expect(patch.translationProvider).toBeUndefined();
    expect(patch.translationUpdatedAt).toBeUndefined();
    expect(patch.status).toBe('ocr_done');
  });

  it('keeps source lifecycle aligned when source text is edited manually', () => {
    const region = createRegion();

    expect(applyRegionLifecyclePatch(region, { sourceText: 'Hello' })).toEqual({
      ocrStatus: 'done',
      status: 'ocr_done',
    });

    expect(
      applyRegionLifecyclePatch(
        createRegion({ sourceText: 'Hello', status: 'ocr_done', ocrStatus: 'done' }),
        { sourceText: '' },
      ),
    ).toEqual({
      ocrStatus: 'idle',
      status: 'idle',
    });
  });
});
