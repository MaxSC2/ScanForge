import { describe, expect, it } from 'vitest';
import { resolveRegionHistoryCaptureOptions } from '../../stores/regionHistoryPolicy';

describe('regionHistoryPolicy', () => {
  it('coalesces text-like region edits into one undo checkpoint window', () => {
    expect(
      resolveRegionHistoryCaptureOptions('page-1', 'region-1', { sourceText: 'hello' }),
    ).toEqual({
      coalesceKey: 'region-text:page-1:region-1',
      windowMs: 900,
    });
  });

  it('coalesces geometry edits into one undo checkpoint window', () => {
    expect(
      resolveRegionHistoryCaptureOptions('page-1', 'region-1', { x: 10, y: 20, width: 30 }),
    ).toEqual({
      coalesceKey: 'region-geometry:page-1:region-1',
      windowMs: 500,
    });
  });

  it('keeps toggle and mixed edits as immediate checkpoints', () => {
    expect(
      resolveRegionHistoryCaptureOptions('page-1', 'region-1', { visible: false }),
    ).toBeUndefined();

    expect(
      resolveRegionHistoryCaptureOptions('page-1', 'region-1', {
        sourceText: 'hello',
        visible: false,
      }),
    ).toBeUndefined();
  });
});
