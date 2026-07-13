import { useEffect, useState } from 'react';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';

/** A contextual action suggestion presented to the user, with a label, description, callback, and priority level. */
export interface Suggestion {
  id: string;
  label: string;
  description: string;
  action: () => void;
  priority: 'high' | 'normal';
}

interface Props {
  queueOcr: (pageId: string, regionIds?: string[]) => void;
  queueTranslate: (pageId: string, regionIds?: string[]) => void;
  autoNumber: (pageId: string) => void;
  deleteRegion: (pageId: string, regionId: string) => void;
}

/**
 * Analyzes the active page's region state and returns contextual suggestions:
 * - Prompts the user to draw regions when the page is empty (high priority).
 * - Recommends OCR run when idle regions without source text are detected (high priority).
 * - Recommends translation when OCR-done regions lack translations (high priority).
 * - Flags OCR/translation failures for specific regions with one-click retry (high priority).
 * - Detects overlapping region pairs and warns about layout issues (normal priority).
 *
 * The suggestion list updates reactively whenever `activePageId`, `pages`, or the action callbacks change.
 */
export function useAutoSuggest({ queueOcr, queueTranslate, autoNumber: _autoNumber, deleteRegion: _deleteRegion }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const activePageId = usePageStore((s) => s.activePageId);
  const pages = usePageStore((s) => s.pages);
  const selectRegion = useRegionStore((s) => s.selectRegion);

  useEffect(() => {
    if (!activePageId) { setSuggestions([]); return; }

    const page = pages.find((p) => p.id === activePageId);
    if (!page) { setSuggestions([]); return; }

    const result: Suggestion[] = [];
    let idCounter = 0;
    const nextId = () => `sug-${Date.now()}-${++idCounter}`;

    const regions = page.regions;

    if (regions.length === 0) {
      result.push({
        id: nextId(),
        label: 'Нарисовать регионы',
        description: 'На странице нет регионов. Используй инструмент «Регион» (R) чтобы выделить области.',
        priority: 'high',
        action: () => {},
      });
    }

    const idleOcr = regions.filter((r) => r.ocrStatus === 'idle');
    if (idleOcr.length > 0) {
      result.push({
        id: nextId(),
        label: `OCR (${idleOcr.length} регионов)`,
        description: `${idleOcr.length} регионов без распознанного текста. Запустить OCR?`,
        priority: 'high',
        action: () => queueOcr(activePageId),
      });
    }

    const ocrNotTranslated = regions.filter((r) => r.ocrStatus === 'done' && r.translationStatus === 'idle' && r.sourceText);
    if (ocrNotTranslated.length > 0) {
      result.push({
        id: nextId(),
        label: `Перевод (${ocrNotTranslated.length} регионов)`,
        description: `${ocrNotTranslated.length} регионов с OCR, но без перевода. Запустить перевод?`,
        priority: 'high',
        action: () => queueTranslate(activePageId),
      });
    }

    const failed = regions.filter((r) => r.ocrStatus === 'failed' || r.translationStatus === 'failed');
    for (const r of failed) {
      result.push({
        id: nextId(),
        label: `Ошибка: ${r.label}`,
        description: r.ocrStatus === 'failed' ? `OCR не удался для региона «${r.label}»` : `Перевод не удался для региона «${r.label}»`,
        priority: 'high',
        action: () => {
          selectRegion(r.id);
          if (r.ocrStatus === 'failed') queueOcr(activePageId, [r.id]);
          else queueTranslate(activePageId, [r.id]);
        },
      });
    }

    if (regions.length > 1) {
      let overlapCount = 0;
      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          const a = regions[i];
          const b = regions[j];
          const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
          const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
          if (ox * oy > 25) overlapCount++;
        }
      }
      if (overlapCount > 0) {
        result.push({
          id: nextId(),
          label: `Наложения (${overlapCount})`,
          description: `${overlapCount} пар регионов пересекаются. Проверь расположение.`,
          priority: 'normal',
          action: () => {},
        });
      }
    }

    setSuggestions(result);
  }, [activePageId, pages, queueOcr, queueTranslate, selectRegion]);

  return suggestions;
}
