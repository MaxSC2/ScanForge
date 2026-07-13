import { useState } from 'react';
import { XIcon } from '../icons';
import { usePluginRegistry } from '../plugins/registry';
import { loadPluginFromSource, savePluginSource, removePluginSource } from '../plugins/loader';
import { useToastStore } from '../stores/useToastStore';
import { useT } from '../i18n';

export function PluginsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const plugins = usePluginRegistry((s) => s.plugins);
  const setEnabled = usePluginRegistry((s) => s.setEnabled);
  const unregisterPlugin = usePluginRegistry((s) => s.unregisterPlugin);
  const pushToast = useToastStore((s) => s.push);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleInstall = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    const manifest = await loadPluginFromSource(trimmed);
    if (manifest) {
      savePluginSource(trimmed);
      pushToast(t('plugins.installed', { name: manifest.name }), 'success');
      setCode('');
    } else {
      pushToast(t('plugins.installError'), 'error');
    }
    setLoading(false);
  };

  const handleRemove = (id: string) => {
    const p = plugins.find((e) => e.manifest.id === id);
    if (p) {
      removePluginSource(p.manifest.source);
      unregisterPlugin(id);
      pushToast(t('plugins.removed', { name: p.manifest.name }), 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">{t('plugins.title')}</span>
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        <div className="mb-3">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('plugins.placeholder')}
            className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-[10px] text-zinc-200 placeholder-zinc-600"
          />
          <button
            onClick={handleInstall}
            disabled={!code.trim() || loading}
            className="mt-1 rounded-md bg-indigo-500/20 px-3 py-1.5 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
          >
            {loading ? t('plugins.installing') : t('plugins.install')}
          </button>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {plugins.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-zinc-600">{t('plugins.empty')}</p>
          ) : (
            plugins.map((entry) => (
              <div
                key={entry.manifest.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={() => setEnabled(entry.manifest.id, !entry.enabled)}
                  className="accent-indigo-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-zinc-200">{entry.manifest.name}</span>
                    <span className="text-[9px] text-zinc-500">v{entry.manifest.version}</span>
                  </div>
                  {entry.manifest.description && (
                    <p className="mt-0.5 truncate text-[9px] text-zinc-500">{entry.manifest.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(entry.manifest.id)}
                  className="rounded px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
