import { create } from 'zustand';

const STORAGE_KEY = 'scanforge.shortcuts';

/** Definition of a single keyboard shortcut: its unique id, default key combination, display label, and grouping category. */
export interface ShortcutDef {
  id: string;
  defaultKeys: string;
  label: string;
  category: string;
}

/**
 * The 47 built-in keyboard shortcuts for ScanForge, organized by category:
 * - Инструменты (tools): select, draw, pan, grid toggle
 * - Регионы (regions): delete, select all, duplicate, navigate, bring to front/back, group/ungroup
 * - Перемещение (movement): nudge 1px/10px in each direction, resize via Alt+arrows
 * - OCR и перевод (OCR & translation): queue OCR, queue translation
 * - Экспорт (export): export PNG, stitch pages
 * - Масштаб (zoom): zoom in/out/reset, actual size, fit width, fit page
 * - Панели (panels): sidebar, inspector, focus mode, clean mode, overlays
 * - История (history): undo, redo
 * - Навигация (navigation): escape, space next, pageup previous
 */
export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: 'tool_select', defaultKeys: 'v', label: 'Инструмент «Выбор»', category: 'Инструменты' },
  { id: 'tool_draw', defaultKeys: 'r', label: 'Инструмент «Регион»', category: 'Инструменты' },
  { id: 'tool_polygon', defaultKeys: 'p', label: 'Инструмент «Полигон»', category: 'Инструменты' },
  { id: 'tool_brush', defaultKeys: 'b', label: 'Инструмент «Кисть»', category: 'Инструменты' },
  { id: 'tool_pan', defaultKeys: 'h', label: 'Инструмент «Панорама»', category: 'Инструменты' },
  { id: 'toggle_grid', defaultKeys: 'g', label: 'Переключить сетку', category: 'Инструменты' },
  { id: 'delete_region', defaultKeys: 'del', label: 'Удалить выбранный регион', category: 'Регионы' },
  { id: 'select_all', defaultKeys: 'ctrl+shift+a', label: 'Выбрать все регионы', category: 'Регионы' },
  { id: 'duplicate_region', defaultKeys: 'ctrl+d', label: 'Дублировать регион', category: 'Регионы' },
  { id: 'next_region', defaultKeys: 'tab', label: 'Следующий регион', category: 'Регионы' },
  { id: 'prev_region', defaultKeys: 'shift+tab', label: 'Предыдущий регион', category: 'Регионы' },
  { id: 'move_up', defaultKeys: 'arrowup', label: 'Сдвинуть вверх на 1px', category: 'Перемещение' },
  { id: 'move_down', defaultKeys: 'arrowdown', label: 'Сдвинуть вниз на 1px', category: 'Перемещение' },
  { id: 'move_left', defaultKeys: 'arrowleft', label: 'Сдвинуть влево на 1px', category: 'Перемещение' },
  { id: 'move_right', defaultKeys: 'arrowright', label: 'Сдвинуть вправо на 1px', category: 'Перемещение' },
  { id: 'move_10_up', defaultKeys: 'shift+arrowup', label: 'Сдвинуть вверх на 10px', category: 'Перемещение' },
  { id: 'move_10_down', defaultKeys: 'shift+arrowdown', label: 'Сдвинуть вниз на 10px', category: 'Перемещение' },
  { id: 'move_10_left', defaultKeys: 'shift+arrowleft', label: 'Сдвинуть влево на 10px', category: 'Перемещение' },
  { id: 'move_10_right', defaultKeys: 'shift+arrowright', label: 'Сдвинуть вправо на 10px', category: 'Перемещение' },
  { id: 'resize_up', defaultKeys: 'alt+arrowup', label: 'Увеличить высоту', category: 'Перемещение' },
  { id: 'resize_down', defaultKeys: 'alt+arrowdown', label: 'Уменьшить высоту', category: 'Перемещение' },
  { id: 'resize_left', defaultKeys: 'alt+arrowleft', label: 'Уменьшить ширину', category: 'Перемещение' },
  { id: 'resize_right', defaultKeys: 'alt+arrowright', label: 'Увеличить ширину', category: 'Перемещение' },
  { id: 'queue_ocr', defaultKeys: 'ctrl+shift+o', label: 'Запустить OCR', category: 'OCR и перевод' },
  { id: 'queue_translate', defaultKeys: 'ctrl+shift+t', label: 'Запустить перевод', category: 'OCR и перевод' },
  { id: 'process_all', defaultKeys: 'ctrl+shift+p', label: 'Пайплайн: OCR → Перевод', category: 'OCR и перевод' },
  { id: 'export_png', defaultKeys: 'ctrl+shift+e', label: 'Экспорт в PNG', category: 'Экспорт' },
  { id: 'stitch_pages', defaultKeys: 'ctrl+m', label: 'Склеить страницы', category: 'Склейка' },
  { id: 'zoom_in', defaultKeys: 'ctrl+=', label: 'Приблизить', category: 'Масштаб' },
  { id: 'zoom_out', defaultKeys: 'ctrl+-', label: 'Отдалить', category: 'Масштаб' },
  { id: 'zoom_reset', defaultKeys: 'ctrl+0', label: 'Сброс масштаба', category: 'Масштаб' },
  { id: 'view_actual', defaultKeys: 'ctrl+shift+1', label: 'Реальный размер', category: 'Масштаб' },
  { id: 'view_fit_width', defaultKeys: 'ctrl+shift+w', label: 'По ширине', category: 'Масштаб' },
  { id: 'view_fit_page', defaultKeys: 'ctrl+shift+f', label: 'По странице', category: 'Масштаб' },
  { id: 'toggle_sidebar', defaultKeys: 'ctrl+b', label: 'Переключить боковую панель', category: 'Панели' },
  { id: 'toggle_inspector', defaultKeys: 'ctrl+i', label: 'Переключить инспектор', category: 'Панели' },
  { id: 'toggle_focus', defaultKeys: 'ctrl+.', label: 'Фокус-режим', category: 'Панели' },
  { id: 'toggle_clean', defaultKeys: 'ctrl+shift+.', label: 'Чистый режим', category: 'Панели' },
  { id: 'toggle_overlays', defaultKeys: 'ctrl+shift+h', label: 'Оверлеи регионов', category: 'Панели' },
  { id: 'undo', defaultKeys: 'ctrl+z', label: 'Отменить', category: 'История' },
  { id: 'redo', defaultKeys: 'ctrl+shift+z', label: 'Повторить', category: 'История' },
  { id: 'escape', defaultKeys: 'esc', label: 'Выйти из чистого режима / снять выделение', category: 'Навигация' },
  { id: 'bring_to_front', defaultKeys: 'ctrl+shift+]', label: 'На передний план', category: 'Регионы' },
  { id: 'send_to_back', defaultKeys: 'ctrl+shift+[', label: 'На задний план', category: 'Регионы' },
  { id: 'group_regions', defaultKeys: 'ctrl+g', label: 'Сгруппировать регионы', category: 'Регионы' },
  { id: 'ungroup_regions', defaultKeys: 'ctrl+shift+g', label: 'Разгруппировать', category: 'Регионы' },
  { id: 'next_page_clean', defaultKeys: 'space', label: 'Следующая страница (чистый режим)', category: 'Навигация' },
  { id: 'prev_page_clean', defaultKeys: 'pageup', label: 'Предыдущая страница (чистый режим)', category: 'Навигация' },
];

/**
 * Converts a machine-readable key combo string (e.g. "ctrl+shift+a") to a human-readable display string
 * (e.g. "Ctrl+Shift+A"). Known modifiers are capitalized; other key names are Title-cased.
 */
export function formatKeys(keys: string): string {
  return keys
    .split('+')
    .map((p) => {
      const m: Record<string, string> = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', meta: 'Cmd' };
      return m[p] || (p.charAt(0).toUpperCase() + p.slice(1));
    })
    .join('+');
}

/**
 * Parses a key combo string into its modifier flags and primary key.
 * Handles multi-character keys by joining non-modifier parts with "+".
 * Example: "ctrl+shift+arrowup" → { ctrl: true, shift: true, alt: false, key: "arrowup" }
 */
export function parseKeys(keys: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean } {
  const parts = keys.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter((p) => !['ctrl', 'shift', 'alt', 'meta'].includes(p)).join('+'),
  };
}

/**
 * Tests whether a raw KeyboardEvent matches a shortcut combo string.
 * Handles special key aliases: "esc" → Escape, "del" → Delete/Backspace, "space" → Space/' '.
 * Uses `event.code` as a fallback when `event.key` does not match.
 */
export function matchEvent(event: KeyboardEvent, keys: string): boolean {
  const combo = parseKeys(keys);
  const ctrl = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (ctrl !== combo.ctrl) return false;
  if (event.shiftKey !== combo.shift) return false;
  if (event.altKey !== combo.alt) return false;

  if (combo.key === 'esc') return key === 'escape';
  if (combo.key === 'del') return key === 'delete' || key === 'backspace';
  if (combo.key === 'space') return key === ' ' || key === 'space';
  return key === combo.key || event.code?.toLowerCase() === combo.key;
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

/** Zustand state and actions for user-customizable keyboard shortcut bindings, persisted to localStorage. */
interface ShortcutsState {
  overrides: Record<string, string>;
  getBinding: (id: string) => string;
  setBinding: (id: string, keys: string) => void;
  resetBinding: (id: string) => void;
  resetAll: () => void;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  overrides: loadOverrides(),
  getBinding: (id: string) => {
    const def = SHORTCUT_DEFS.find((d) => d.id === id);
    if (!def) return '';
    return get().overrides[id] ?? def.defaultKeys;
  },
  setBinding: (id: string, keys: string) => {
    set((s) => {
      const next = { ...s.overrides, [id]: keys };
      saveOverrides(next);
      return { overrides: next };
    });
  },
  resetBinding: (id: string) => {
    set((s) => {
      const next = { ...s.overrides };
      delete next[id];
      saveOverrides(next);
      return { overrides: next };
    });
  },
  resetAll: () => {
    saveOverrides({});
    set({ overrides: {} });
  },
}));
