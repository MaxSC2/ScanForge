import { useState } from 'react';
import { usePresetsStore, type Preset } from '../stores/usePresetsStore';
import { useProjectDomainStore } from '../stores/useProjectDomainStore';
import { useToastStore } from '../stores/useToastStore';
import { XIcon } from '../icons';

export function PresetsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const presets = usePresetsStore((s) => s.presets);
  const savePreset = usePresetsStore((s) => s.savePreset);
  const deletePreset = usePresetsStore((s) => s.deletePreset);
  const renamePreset = usePresetsStore((s) => s.renamePreset);
  const settings = useProjectDomainStore((s) => s.settings);
  const updateSettings = useProjectDomainStore((s) => s.updateSettings);
  const pushToast = useToastStore((s) => s.push);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!open) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || !settings) return;
    savePreset(trimmed, {
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
      ocrEngine: settings.ocrEngine,
      translationProvider: settings.translationProvider,
      inpaintingProvider: settings.inpaintingProvider,
      autoRunOcr: settings.autoRunOcr,
    });
    pushToast(`Пресет «${trimmed}» сохранён`, 'success');
    setName('');
    setSaving(false);
  };

  const handleApply = async (preset: Preset) => {
    if (!settings) return;
    await updateSettings({
      sourceLanguage: preset.sourceLanguage,
      targetLanguage: preset.targetLanguage,
      ocrEngine: preset.ocrEngine,
      translationProvider: preset.translationProvider,
      inpaintingProvider: preset.inpaintingProvider,
      autoRunOcr: preset.autoRunOcr,
    });
    pushToast(`Пресет «${preset.name}» применён`, 'success');
  };

  const startRename = (preset: Preset) => {
    setRenamingId(preset.id);
    setRenameValue(preset.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renamePreset(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">Пресеты проектов</span>
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        {settings && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название пресета..."
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="rounded-md bg-indigo-500/20 px-3 py-1.5 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
              >
                {saving ? '…' : 'Сохранить'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-500">
              <span>OCR: {settings.ocrEngine}</span>
              <span>Перевод: {settings.translationProvider}</span>
              <span>Язык: {settings.sourceLanguage}→{settings.targetLanguage}</span>
              <span>Inpaint: {settings.inpaintingProvider}</span>
            </div>
          </div>
        )}

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {presets.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-zinc-600">
              Нет сохранённых пресетов
            </p>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="group flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  {renamingId === preset.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-200"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      onBlur={commitRename}
                    />
                  ) : (
                    <div className="text-[11px] font-medium text-zinc-200">{preset.name}</div>
                  )}
                  <div className="mt-0.5 text-[9px] text-zinc-500">
                    {preset.sourceLanguage}→{preset.targetLanguage} · {preset.ocrEngine} · {preset.translationProvider}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleApply(preset)}
                    className="rounded px-2 py-1 text-[10px] text-indigo-400 hover:bg-indigo-500/10"
                  >
                    Загрузить
                  </button>
                  <button
                    onClick={() => startRename(preset)}
                    className="rounded px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    R
                  </button>
                  <button
                    onClick={() => { deletePreset(preset.id); pushToast(`Пресет «${preset.name}» удалён`, 'info'); }}
                    className="rounded px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
