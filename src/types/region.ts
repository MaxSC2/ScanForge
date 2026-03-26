export interface Region {
  id: string;
  /** Display label, e.g. "Bubble 3" */
  label: string;
  /** Pixel coordinates relative to the source image */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Original (source) text – filled later by OCR */
  sourceText: string;
  /** Translated text – filled by user or AI */
  translatedText: string;
  /** Region kind for future workflows */
  kind: RegionKind;
  /** Ordering index for reading flow */
  order: number;
  /** Freeform notes */
  notes: string;
  /** Whether the region is locked from editing */
  locked: boolean;
  /** Whether the region is visible on canvas */
  visible: boolean;
}

export type RegionKind = 'speech' | 'sfx' | 'narration' | 'other';

export const REGION_KIND_OPTIONS: { value: RegionKind; label: string; color: string }[] = [
  { value: 'speech', label: 'Речь', color: '#6366f1' },
  { value: 'sfx', label: 'SFX', color: '#f59e0b' },
  { value: 'narration', label: 'Нарратив', color: '#10b981' },
  { value: 'other', label: 'Другое', color: '#8b5cf6' },
];

export function getRegionColor(kind: RegionKind): string {
  return REGION_KIND_OPTIONS.find((o) => o.value === kind)?.color ?? '#6366f1';
}
