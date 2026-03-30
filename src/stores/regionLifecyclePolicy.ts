import type { Region } from '../types';

const MANUAL_TRANSLATION_PROVIDER = 'manual';

function hasOwnPatchValue<T extends object, K extends keyof T>(patch: Partial<T>, key: K) {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

export function applyRegionLifecyclePatch(
  region: Region,
  patch: Partial<Region>,
  now = Date.now(),
): Partial<Region> {
  const next = { ...region, ...patch };
  const lifecyclePatch: Partial<Region> = {};
  const sourceTouched = hasOwnPatchValue(patch, 'sourceText');
  const translationTouched = hasOwnPatchValue(patch, 'translatedText');

  if (translationTouched) {
    if (next.translatedText.trim()) {
      if (!hasOwnPatchValue(patch, 'translationStatus')) {
        lifecyclePatch.translationStatus = 'done';
      }
      if (!hasOwnPatchValue(patch, 'translationProvider')) {
        lifecyclePatch.translationProvider = MANUAL_TRANSLATION_PROVIDER;
      }
      if (!hasOwnPatchValue(patch, 'translationUpdatedAt')) {
        lifecyclePatch.translationUpdatedAt = now;
      }
    } else {
      if (!hasOwnPatchValue(patch, 'translationStatus')) {
        lifecyclePatch.translationStatus = 'idle';
      }
      if (!hasOwnPatchValue(patch, 'translationProvider')) {
        lifecyclePatch.translationProvider = undefined;
      }
      if (!hasOwnPatchValue(patch, 'translationUpdatedAt')) {
        lifecyclePatch.translationUpdatedAt = undefined;
      }
    }
  }

  if (sourceTouched && !hasOwnPatchValue(patch, 'ocrStatus')) {
    lifecyclePatch.ocrStatus = next.sourceText.trim() ? 'done' : 'idle';
  }

  if ((sourceTouched || translationTouched) && !hasOwnPatchValue(patch, 'status')) {
    lifecyclePatch.status = next.translatedText.trim()
      ? 'translated'
      : next.sourceText.trim()
        ? 'ocr_done'
        : 'idle';
  }

  return lifecyclePatch;
}
