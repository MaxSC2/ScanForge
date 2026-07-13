import { useState } from 'react';
import { XIcon } from '../icons';
import { useTemplateStore } from '../templates/store';
import { useRegionStore } from '../stores/useRegionStore';
import { usePageStore } from '../stores/usePageStore';
import { useToastStore } from '../stores/useToastStore';
import { BUILTIN_TEMPLATES } from '../templates/presets';
import type { RegionTemplate } from '../templates/types';

export function TemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addTemplate = useTemplateStore((s) => s.addTemplate);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const customTemplates = useTemplateStore((s) => s.customTemplates);
  const addRegion = useRegionStore((s) => s.addRegion);
  const activePage = usePageStore((s) => s.pages.find((p) => p.id === s.activePageId));
  const pushToast = useToastStore((s) => s.push);

  const [name, setName] = useState('');
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(80);

  if (!open) return null;

  const handleApply = (tmpl: RegionTemplate) => {
    if (!activePage) {
      pushToast('Открой страницу для применения шаблона', 'warning');
      return;
    }
    addRegion(activePage.id, { x: 100, y: 100, width: tmpl.width, height: tmpl.height });
    pushToast(`Шаблон «${tmpl.name}» применён`, 'success');
  };

  const handleSave = () => {
    if (!name.trim()) return;
    addTemplate({ name: name.trim(), kind: 'speech', width, height, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' });
    pushToast(`Шаблон «${name}» сохранён`, 'success');
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">Шаблоны регионов</span>
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        {/* Custom template saver */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя шаблона"
            className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-600"
          />
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-16 rounded border border-zinc-800 bg-zinc-900 px-1 py-1 text-[11px] text-zinc-200"
            title="Ширина"
          />
          <span className="text-[10px] text-zinc-600">×</span>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-16 rounded border border-zinc-800 bg-zinc-900 px-1 py-1 text-[11px] text-zinc-200"
            title="Высота"
          />
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded bg-indigo-500/20 px-2 py-1 text-[11px] text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto">
          {BUILTIN_TEMPLATES.map((cat) => (
            <div key={cat.id}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{cat.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleApply(tmpl)}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 text-left text-[11px] text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    <div className="font-medium">{tmpl.name}</div>
                    <div className="text-[9px] text-zinc-500">{tmpl.width}×{tmpl.height}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {customTemplates.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Пользовательские</p>
              <div className="flex flex-wrap gap-1.5">
                {customTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="group relative rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 text-left"
                  >
                    <button
                      onClick={() => handleApply(tmpl)}
                      className="text-[11px] text-zinc-300 hover:text-zinc-200"
                    >
                      <div className="font-medium">{tmpl.name}</div>
                      <div className="text-[9px] text-zinc-500">{tmpl.width}×{tmpl.height}</div>
                    </button>
                    <button
                      onClick={() => { removeTemplate(tmpl.id); pushToast(`Шаблон «${tmpl.name}» удалён`, 'info'); }}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-red-500/20 px-1 text-[9px] text-red-400 group-hover:block"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
