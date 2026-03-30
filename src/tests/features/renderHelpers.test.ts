import { describe, expect, it } from 'vitest';
import {
  buildRenderedPngName,
  computeSha256Hex,
  resolveTextStyle,
  shortenHash,
} from '../../features/export/renderHelpers';
import { createDefaultTextStyle, type RegionRecord, type TextStyleRecord } from '../../types';

function makeRegion(overrides: Partial<RegionRecord> = {}): RegionRecord {
  return {
    id: 'region-1',
    pageId: 'page-1',
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    rotation: 0,
    label: 'Region 1',
    kind: 'speech',
    order: 1,
    orientation: 'horizontal',
    sourceText: 'Hello',
    translatedText: 'Привет',
    status: 'translated',
    ocrStatus: 'done',
    translationStatus: 'done',
    notes: '',
    locked: false,
    visible: true,
    ...overrides,
  };
}

function makeStyle(id: string, name: string): TextStyleRecord {
  return {
    ...createDefaultTextStyle('project-1'),
    id,
    name,
  };
}

describe('renderHelpers', () => {
  it('appends rendered suffix to exported png names', () => {
    expect(buildRenderedPngName('page-01.png')).toBe('page-01-rendered.png');
    expect(buildRenderedPngName('chapter')).toBe('chapter-rendered.png');
  });

  it('prefers region style over project default style', () => {
    const projectDefault = makeStyle('project-1:default-style', 'Default');
    const regionStyle = makeStyle('style-special', 'Special');
    const resolved = resolveTextStyle(
      makeRegion({ textStyleId: 'style-special' }),
      [projectDefault, regionStyle],
      'project-1',
      'project-1:default-style',
    );

    expect(resolved.id).toBe('style-special');
  });

  it('falls back to project default style when region style is absent', () => {
    const projectDefault = makeStyle('project-1:default-style', 'Default');
    const resolved = resolveTextStyle(
      makeRegion(),
      [projectDefault],
      'project-1',
      'project-1:default-style',
    );

    expect(resolved.id).toBe('project-1:default-style');
  });

  it('creates a hard fallback style when no styles are available', () => {
    const resolved = resolveTextStyle(makeRegion(), [], 'project-1');
    expect(resolved.id).toBe('project-1:default-style');
    expect(resolved.name).toBe('Default');
  });

  it('computes deterministic sha256 fingerprints for export artifacts', async () => {
    const first = await computeSha256Hex(new TextEncoder().encode('scanforge-export'));
    const second = await computeSha256Hex(new TextEncoder().encode('scanforge-export'));

    expect(first).toBe(second);
    expect(shortenHash(first)).toHaveLength(8);
  });
});
