import { describe, expect, it } from 'vitest';
import {
  buildLocalDraftTranslation,
  buildPreviewTranslation,
} from '../../services/translationDraft';

describe('translationDraft', () => {
  it('translates known english words into russian draft text', () => {
    expect(buildLocalDraftTranslation('Hello friend', 'ru')).toBe('Привет друг');
  });

  it('preserves uppercase styling for translated words', () => {
    expect(buildLocalDraftTranslation('HELLO', 'ru')).toBe('ПРИВЕТ');
  });

  it('falls back to a tagged draft when no dictionary match exists', () => {
    expect(buildLocalDraftTranslation('Quantum relay', 'ru')).toBe(
      '[ru draft] Quantum relay',
    );
  });

  it('builds preview translation labels for english output', () => {
    expect(buildPreviewTranslation('Привет мир', 'en')).toBe(
      '[preview en] Привет мир',
    );
  });
});
