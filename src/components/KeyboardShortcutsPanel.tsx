import { useEffect, useRef, useState } from 'react';
import { KeyboardIcon, XIcon } from '../icons';

interface ShortcutEntry {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; items: ShortcutEntry[] }[] = [
  {
    title: 'Инструменты',
    items: [
      { keys: ['V'], label: 'Инструмент «Выбор»' },
      { keys: ['R'], label: 'Инструмент «Регион»' },
      { keys: ['H'], label: 'Инструмент «Панорама»' },
      { keys: ['G'], label: 'Переключить сетку' },
    ],
  },
  {
    title: 'Регионы',
    items: [
      { keys: ['Del'], label: 'Удалить выбранный регион' },
      { keys: ['Ctrl+Shift+A'], label: 'Выбрать все регионы на странице' },
      { keys: ['↑ ↓ ← →'], label: 'Сдвинуть регион на 1px' },
      { keys: ['Shift', '↑ ↓ ← →'], label: 'Сдвинуть регион на 10px' },
      { keys: ['Alt', '↑ ↓ ← →'], label: 'Изменить размер региона' },
      { keys: ['Ctrl+D'], label: 'Дублировать регион' },
    ],
  },
  {
    title: 'OCR и перевод',
    items: [
      { keys: ['Ctrl+Shift+O'], label: 'Запустить OCR' },
      { keys: ['Ctrl+Shift+T'], label: 'Запустить перевод' },
    ],
  },
  {
    title: 'Экспорт',
    items: [
      { keys: ['Ctrl+Shift+E'], label: 'Экспорт рендера в PNG' },
    ],
  },
  {
    title: 'Склейка',
    items: [
      { keys: ['Ctrl+M'], label: 'Склеить выбранные страницы' },
    ],
  },
  {
    title: 'Масштаб',
    items: [
      { keys: ['Ctrl++'], label: 'Приблизить' },
      { keys: ['Ctrl+-'], label: 'Отдалить' },
      { keys: ['Ctrl+0'], label: 'Сброс масштаба' },
      { keys: ['Ctrl+Shift+1'], label: 'Реальный размер (1:1)' },
      { keys: ['Ctrl+Shift+W'], label: 'По ширине' },
      { keys: ['Ctrl+Shift+F'], label: 'По странице' },
    ],
  },
  {
    title: 'Панели',
    items: [
      { keys: ['Ctrl+B'], label: 'Переключить боковую панель' },
      { keys: ['Ctrl+I'], label: 'Переключить инспектор' },
      { keys: ['Ctrl+.'], label: 'Фокус-режим' },
      { keys: ['Ctrl+Shift+.'], label: 'Чистый режим' },
      { keys: ['Ctrl+Shift+H'], label: 'Оверлеи регионов' },
    ],
  },
  {
    title: 'История',
    items: [
      { keys: ['Ctrl+Z'], label: 'Отменить' },
      { keys: ['Ctrl+Shift+Z'], label: 'Повторить' },
    ],
  },
  {
    title: 'Навигация',
    items: [
      { keys: ['← / ↑ / PageUp'], label: 'Предыдущая страница' },
      { keys: ['→ / ↓ / Space'], label: 'Следующая страница' },
      { keys: ['Esc'], label: 'Выйти из чистого режима / снять выделение' },
    ],
  },
];

interface KeyboardShortcutsPanelProps {
  onBeforeOpen?: () => void;
}

export function KeyboardShortcutsPanel({ onBeforeOpen }: KeyboardShortcutsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => {
          if (!open) onBeforeOpen?.();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-zinc-500">
          <KeyboardIcon size={12} />
        </span>
        <span className="min-w-0 flex-1 truncate">Горячие клавиши</span>
        <span className="text-[10px] text-zinc-500">?</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 pt-12 backdrop-blur-sm">
          <div
            ref={panelRef}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/98 p-4 shadow-2xl shadow-black/50"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <KeyboardIcon size={14} className="text-zinc-500" />
                Горячие клавиши
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <XIcon size={13} />
              </button>
            </div>

            {SECTIONS.map((section) => (
              <div key={section.title} className="mb-3">
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-900"
                    >
                      <span className="text-[11px] text-zinc-300">{item.label}</span>
                      <span className="ml-4 flex flex-none items-center gap-1">
                        {item.keys.map((keyCombo) => (
                          <kbd
                            key={keyCombo}
                            className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400"
                          >
                            {keyCombo}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
