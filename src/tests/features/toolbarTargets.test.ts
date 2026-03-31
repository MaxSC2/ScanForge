import { describe, expect, it } from 'vitest';
import { buildOcrTargets, buildTranslationTargets } from '../../features/toolbar/toolbarTargets';

describe('toolbarTargets', () => {
  it('targets selected region before page selection', () => {
    expect(
      buildOcrTargets({
        activePageId: 'page-1',
        selectedPageIds: ['page-2'],
        selectedRegionId: 'region-1',
      }),
    ).toEqual([{ pageId: 'page-1', regionIds: ['region-1'] }]);
  });

  it('falls back to selected pages when no region is selected', () => {
    expect(
      buildTranslationTargets({
        activePageId: 'page-1',
        selectedPageIds: ['page-2', 'page-3'],
        selectedRegionId: null,
      }),
    ).toEqual([{ pageId: 'page-2' }, { pageId: 'page-3' }]);
  });

  it('uses active page when nothing else is selected', () => {
    expect(
      buildOcrTargets({
        activePageId: 'page-1',
        selectedPageIds: [],
        selectedRegionId: null,
      }),
    ).toEqual([{ pageId: 'page-1' }]);
  });

  it('returns empty targets when there is no active or selected page', () => {
    expect(
      buildTranslationTargets({
        activePageId: null,
        selectedPageIds: [],
        selectedRegionId: null,
      }),
    ).toEqual([]);
  });
});
