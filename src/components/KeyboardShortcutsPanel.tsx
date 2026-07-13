import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { KeyboardIcon, XIcon } from '../icons';
import { SHORTCUT_DEFS, formatKeys, useShortcutsStore } from '../stores/useShortcutsStore';

interface KeyboardShortcutsPanelProps {
  onBeforeOpen?: () => void;
}

export function KeyboardShortcutsPanel({ onBeforeOpen }: KeyboardShortcutsPanelProps) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const resetBinding = useShortcutsStore((s) => s.resetBinding);
  const resetAll = useShortcutsStore((s) => s.resetAll);
  const overrides = useShortcutsStore((s) => s.overrides);

  const getBinding = useCallback(
    (id: string) => overrides[id] ?? SHORTCUT_DEFS.find((d) => d.id === id)?.defaultKeys ?? '',
    [overrides],
  );

  const sections = SHORTCUT_DEFS.reduce<
    { title: string; items: { id: string; label: string }[] }[]
  >((acc, def) => {
    let section = acc.find((s) => s.title === def.category);
    if (!section) {
      section = { title: def.category, items: [] };
      acc.push(section);
    }
    section.items.push({ id: def.id, label: def.label });
    return acc;
  }, []);

  const handleRecord = useCallback((id: string) => {
    setRecording(id);
  }, []);

  const handleReset = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      resetBinding(id);
    },
    [resetBinding],
  );

  useEffect(() => {
    if (!open) {
      setRecording(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (recording) {
          setRecording(null);
          return;
        }
        setOpen(false);
        return;
      }

      if (recording) {
        event.preventDefault();
        event.stopPropagation();
        const parts: string[] = [];
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
        if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
          parts.push(key);
          useShortcutsStore.getState().setBinding(recording, parts.join('+'));
          setRecording(null);
        }
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        return;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      setRecording(null);
      setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, recording]);

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
              <div className="flex items-center gap-1">
                <button
                  onClick={resetAll}
                  className="flex h-6 items-center gap-1 rounded-md px-2 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  title="Сбросить все"
                >
                  <RotateCcw size={11} />
                  Сброс
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <XIcon size={13} />
                </button>
              </div>
            </div>

            {recording && (
              <div className="mb-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-center text-[11px] text-indigo-300">
                Нажми новую комбинацию клавиш...
              </div>
            )}

            {sections.map((section) => (
              <div key={section.title} className="mb-3">
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const binding = getBinding(item.id);
                    const isOverridden = overrides[item.id] !== undefined;
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors ${
                          recording === item.id
                            ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40'
                            : 'hover:bg-zinc-900'
                        }`}
                      >
                        <span className="text-[11px] text-zinc-300">{item.label}</span>
                        <span className="ml-4 flex flex-none items-center gap-1">
                          <button
                            onClick={() => handleRecord(item.id)}
                            className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                            title="Изменить"
                          >
                            {formatKeys(binding)}
                          </button>
                          {isOverridden && (
                            <button
                              onClick={(e) => handleReset(e, item.id)}
                              className="rounded p-0.5 text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
                              title="Сбросить"
                            >
                              <RotateCcw size={10} />
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <p className="text-center text-[9px] text-zinc-700">
              Кликни по клавише чтобы изменить. Нажми Escape для отмены.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
