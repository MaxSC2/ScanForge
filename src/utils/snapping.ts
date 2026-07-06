export const SNAP_THRESHOLD = 8;
export const GRID_STEP = 50;

export interface SnapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function snapValue(value: number, step: number, threshold: number): number {
  const remainder = value % step;
  if (Math.abs(remainder) < threshold) {
    return value - remainder;
  }
  if (Math.abs(remainder) > step - threshold) {
    return value - remainder + (remainder > 0 ? step : -step);
  }
  return value;
}

/** Find the nearest edge match among other regions. */
function snapEdge(
  draggedEdge: number,
  otherEdges: number[],
  threshold: number,
): number | null {
  let best = null as number | null;
  let bestDist = threshold;
  for (const edge of otherEdges) {
    const dist = Math.abs(draggedEdge - edge);
    if (dist < bestDist) {
      bestDist = dist;
      best = edge;
    }
  }
  return best;
}

export function snapRect(
  rect: SnapRect,
  snapToGrid: boolean,
  gridStep: number,
  threshold: number,
  otherRegions: SnapRect[] = [],
): SnapRect {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  let dx = 0;
  let dy = 0;

  // Grid snap
  if (snapToGrid) {
    const sx = snapValue(rect.x, gridStep, threshold);
    const sy = snapValue(rect.y, gridStep, threshold);
    const sr = snapValue(right, gridStep, threshold);
    const sb = snapValue(bottom, gridStep, threshold);
    dx += sx - rect.x;
    dy += sy - rect.y;
  }

  // Edge snap to other regions
  if (otherRegions.length > 0) {
    const otherLefts = otherRegions.map((r) => r.x);
    const otherRights = otherRegions.map((r) => r.x + r.width);
    const otherTops = otherRegions.map((r) => r.y);
    const otherBottoms = otherRegions.map((r) => r.y + r.height);
    const otherCXs = otherRegions.map((r) => r.x + r.width / 2);
    const otherCYs = otherRegions.map((r) => r.y + r.height / 2);

    // Horizontal alignment candidates
    const hCandidates: { target: number; score: number }[] = [];
    const pushH = (val: number) => {
      const match = snapEdge(val, otherLefts.concat(otherRights, otherCXs), threshold);
      if (match !== null) hCandidates.push({ target: match - (val - rect.x), score: Math.abs(match - val) });
    };
    pushH(rect.x);
    pushH(right);
    pushH(cx);

    // Vertical alignment candidates
    const vCandidates: { target: number; score: number }[] = [];
    const pushV = (val: number) => {
      const match = snapEdge(val, otherTops.concat(otherBottoms, otherCYs), threshold);
      if (match !== null) vCandidates.push({ target: match - (val - rect.y), score: Math.abs(match - val) });
    };
    pushV(rect.y);
    pushV(bottom);
    pushV(cy);

    // Pick best horizontal alignment
    if (hCandidates.length > 0) {
      hCandidates.sort((a, b) => a.score - b.score);
      dx += hCandidates[0].target - (rect.x + dx);
    }

    // Pick best vertical alignment
    if (vCandidates.length > 0) {
      vCandidates.sort((a, b) => a.score - b.score);
      dy += vCandidates[0].target - (rect.y + dy);
    }
  }

  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: rect.width,
    height: rect.height,
  };
}
