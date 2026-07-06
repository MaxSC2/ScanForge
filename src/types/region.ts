export type RegionKind = 'speech' | 'sfx' | 'narration' | 'other';
export type RegionStatus = 'idle' | 'ocr_done' | 'translated';
export type RegionOrientation = 'horizontal' | 'vertical';
export type RegionOcrStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';
export type RegionTranslationStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';

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
  /** Reading orientation for OCR/render */
  orientation: RegionOrientation;
  /** Original (source) text, usually filled by OCR */
  sourceText: string;
  /** Optional language detected or configured for OCR source */
  sourceLanguage?: string;
  /** Translated text, filled by user or AI later */
  translatedText: string;
  /** Stage 2 domain status */
  status: RegionStatus;
  /** Explicit OCR lifecycle for Stage 3 pipeline */
  ocrStatus: RegionOcrStatus;
  /** Explicit translation lifecycle for Stage 3 pipeline */
  translationStatus: RegionTranslationStatus;
  /** Region kind for current editor workflows */
  kind: RegionKind;
  /** Ordering index for reading flow */
  order: number;
  /** Freeform notes */
  notes: string;
  /** Optional OCR engine identifier */
  ocrEngine?: string;
  /** Optional OCR completion timestamp */
  ocrUpdatedAt?: number;
  /** Optional translation target language */
  targetLanguage?: string;
  /** Optional translation provider identifier */
  translationProvider?: string;
  /** Optional translation completion timestamp */
  translationUpdatedAt?: number;
  /** Whether the region is locked from editing */
  locked: boolean;
  /** Whether the region is visible on canvas */
  visible: boolean;
  /** Optional text style reference for rendered export */
  textStyleId?: string;
  /** Optional OCR confidence score */
  ocrConfidence?: number;
  /** Whether OCR is allowed to overwrite this region on re-run */
  ocrOverwriteEnabled?: boolean;
}

export type RegionHydrationInput = Omit<
  Region,
  | 'rotation'
  | 'orientation'
  | 'status'
  | 'ocrStatus'
  | 'translationStatus'
  | 'ocrConfidence'
  | 'ocrUpdatedAt'
  | 'translationUpdatedAt'
> &
  Partial<
    Pick<
      Region,
      | 'rotation'
      | 'orientation'
      | 'status'
      | 'ocrStatus'
      | 'translationStatus'
      | 'ocrConfidence'
      | 'ocrUpdatedAt'
      | 'translationUpdatedAt'
    >
  >;

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
  const derivedOcrStatus: RegionOcrStatus = sourceText.trim() ? 'done' : 'idle';
  const derivedTranslationStatus: RegionTranslationStatus = translatedText.trim() ? 'done' : 'idle';

  return {
    id: region.id,
    label: region.label ?? 'Region',
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: typeof region.rotation === 'number' ? region.rotation : 0,
    orientation: region.orientation ?? 'horizontal',
    sourceText,
    ...(region.sourceLanguage ? { sourceLanguage: region.sourceLanguage } : {}),
    translatedText,
    status: region.status ?? derivedStatus,
    ocrStatus: region.ocrStatus ?? derivedOcrStatus,
    translationStatus: region.translationStatus ?? derivedTranslationStatus,
    kind: region.kind ?? 'speech',
    order: typeof region.order === 'number' && region.order > 0 ? region.order : 1,
    notes: region.notes ?? '',
    ...(region.ocrEngine ? { ocrEngine: region.ocrEngine } : {}),
    ...(typeof region.ocrUpdatedAt === 'number' ? { ocrUpdatedAt: region.ocrUpdatedAt } : {}),
    ...(region.targetLanguage ? { targetLanguage: region.targetLanguage } : {}),
    ...(region.translationProvider
      ? { translationProvider: region.translationProvider }
      : {}),
    ...(typeof region.translationUpdatedAt === 'number'
      ? { translationUpdatedAt: region.translationUpdatedAt }
      : {}),
    locked: region.locked ?? false,
    visible: region.visible ?? true,
    ...(region.textStyleId ? { textStyleId: region.textStyleId } : {}),
    ...(typeof region.ocrConfidence === 'number'
      ? { ocrConfidence: region.ocrConfidence }
      : {}),
    ...(typeof region.ocrOverwriteEnabled === 'boolean'
      ? { ocrOverwriteEnabled: region.ocrOverwriteEnabled }
      : {}),
  };
}

export function getRegionColor(kind: RegionKind): string {
  return REGION_KIND_OPTIONS.find((o) => o.value === kind)?.color ?? '#6366f1';
}
