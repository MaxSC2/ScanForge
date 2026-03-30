import { describe, expect, it } from 'vitest';
import type { Region } from '../../types';
import {
  getCanvasViewportBounds,
  getWheelViewportTransform,
  isRegionWithinViewport,
  shouldRenderRegionLabel,
} from '../../features/canvas/canvasPerformance';

const baseRegion: Region = {
  id: 'region-1',
  label: 'Region 1',
  x: 100,
  y: 120,
  width: 80,
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
};

describe('canvasPerformance', () => {
  it('computes viewport bounds in page coordinates', () => {
    expect(
      getCanvasViewportBounds({
        zoom: 2,
        stagePosition: { x: -200, y: -100 },
        canvasWidth: 800,
        canvasHeight: 600,
        padding: 0,
      }),
    ).toEqual({
      left: 100,
      top: 50,
      right: 500,
      bottom: 350,
    });
  });

  it('keeps regions that intersect the current viewport', () => {
    const viewport = getCanvasViewportBounds({
      zoom: 1,
      stagePosition: { x: 0, y: 0 },
      canvasWidth: 400,
      canvasHeight: 300,
      padding: 0,
    });

    expect(isRegionWithinViewport(baseRegion, viewport)).toBe(true);
    expect(
      isRegionWithinViewport(
        {
          ...baseRegion,
          id: 'outside',
          x: 460,
          y: 340,
        },
        viewport,
      ),
    ).toBe(false);
  });

  it('hides labels at low zoom unless the region is selected', () => {
    expect(
      shouldRenderRegionLabel({
        labelsVisible: true,
        zoom: 0.3,
        isSelected: false,
      }),
    ).toBe(false);

    expect(
      shouldRenderRegionLabel({
        labelsVisible: true,
        zoom: 0.3,
        isSelected: true,
      }),
    ).toBe(true);
  });

  it('computes one batched viewport transform for wheel zoom around the pointer', () => {
    expect(
      getWheelViewportTransform({
        zoom: 1,
        stagePosition: { x: 0, y: 0 },
        pointer: { x: 200, y: 100 },
        deltaY: -120,
      }),
    ).toEqual({
      zoom: 1.08,
      stagePosition: {
        x: -16,
        y: -8,
      },
    });
  });
});
