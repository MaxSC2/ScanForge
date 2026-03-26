export type RegionKind = 'speech' | 'sfx' | 'narration' | 'other';
export type RegionStatus = 'idle' | 'ocr_done' | 'translated';

export interface Region {
  id: string;
  /** Display label, e.g. "Bubble 3" */
  label: string;
  /** Pixel coordinates relative to the source image */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation angle in degrees */
  rotation: number;
  /** Original (source) text, usually filled by OCR */
  sourceText: string;
  /** Translated text, filled by user or AI later */
  translatedText: string;
  /** Stage 2 domain status */
  status: RegionStatus;
  /** Region kind for current editor workflows */
  kind: RegionKind;
  /** Ordering index for reading flow */
  order: number;
  /** Freeform notes */
  notes: string;
  /** Whether the region is locked from editing */
  locked: boolean;
  /** Whether the region is visible on canvas */
  visible: boolean;
  /** Optional OCR confidence score */
  ocrConfidence?: number;
}

export type RegionHydrationInput = Omit<Region, 'rotation' | 'status' | 'ocrConfidence'> &
  Partial<Pick<Region, 'rotation' | 'status' | 'ocrConfidence'>>;

export const REGION_KIND_OPTIONS: { value: RegionKind; label: string; color: string }[] = [
  { value: 'speech', label: 'Речь', color: '#6366f1' },
  { value: 'sfx', label: 'SFX', color: '#f59e0b' },
  { value: 'narration', label: 'Нарратив', color: '#10b981' },
  { value: 'other', label: 'Другое', color: '#8b5cf6' },
];

export function normalizeRegion(region: RegionHydrationInput): Region {
  const sourceText = region.sourceText ?? '';
  const translatedText = region.translatedText ?? '';
  const derivedStatus: RegionStatus = translatedText.trim()
    ? 'translated'
    : sourceText.trim()
      ? 'ocr_done'
      : 'idle';

  return {
    id: region.id,
    label: region.label ?? 'Region',
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: typeof region.rotation === 'number' ? region.rotation : 0,
    sourceText,
    translatedText,
    status: region.status ?? derivedStatus,
    kind: region.kind ?? 'speech',
    order: typeof region.order === 'number' && region.order > 0 ? region.order : 1,
    notes: region.notes ?? '',
    locked: region.locked ?? false,
    visible: region.visible ?? true,
    ...(typeof region.ocrConfidence === 'number'
      ? { ocrConfidence: region.ocrConfidence }
      : {}),
  };
}

export function getRegionColor(kind: RegionKind): string {
  return REGION_KIND_OPTIONS.find((o) => o.value === kind)?.color ?? '#6366f1';
}
