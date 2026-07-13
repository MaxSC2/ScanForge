import { useState, useEffect, useCallback, useRef } from 'react';
import { DatabaseIcon, DownloadIcon, XIcon } from '../icons';
import { usePageStore } from '../stores/usePageStore';
import { useProjectDomainStore } from '../stores/useProjectDomainStore';
import { useToastStore } from '../stores/useToastStore';
import { getConfig, setConfig, sendToServer, downloadResult, connectWebSocket } from '../services/apiServer';
import type { ServerConfig } from '../types/server';

export function ServerSendDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pages = usePageStore((s) => s.pages);
  const pushToast = useToastStore((s) => s.push);
  const [config, setConfigState] = useState<ServerConfig>(getConfig);
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [jobProgress, setJobProgress] = useState(0);
  const [jobDone, setJobDone] = useState(false);
  const wsCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (open) {
      setConfigState(getConfig());
      setSending(false);
      setJobId(null);
      setJobStatus('');
      setJobProgress(0);
      setJobDone(false);
    }
    return () => {
      wsCleanup.current?.();
    };
  }, [open]);

  const handleSend = useCallback(async () => {
    if (pages.length === 0) return;

    setConfig(config);
    setSending(true);
    setJobId(null);
    setJobStatus('Connecting...');

    try {
      // Collect all page images as blobs
      const files: File[] = await Promise.all(
        pages.map(async (page, i) => {
          const resp = await fetch(page.imageUrl);
          const blob = await resp.blob();
          const ext = page.imageUrl.includes('webp') ? 'webp' :
                      page.imageUrl.includes('png') ? 'png' : 'jpg';
          return new File([blob], `page_${i + 1}.${ext}`, { type: blob.type });
        }),
      );

      const settings = useProjectDomainStore.getState().settings;
      const sourceLang = settings?.sourceLanguage ?? 'ja';
      const targetLang = settings?.targetLanguage ?? 'ru';

      const jid = await sendToServer(files, sourceLang, targetLang);
      setJobId(jid);
      setJobStatus('Processing...');

      // WebSocket for progress
      wsCleanup.current = connectWebSocket(jid, (data) => {
        setJobProgress(data.progress);
        setJobStatus(data.message || `Page ${data.currentPage}/${data.pageCount}`);
        if (data.status === 'done') {
          setJobDone(true);
          setJobStatus('Done!');
          pushToast('Server processing complete!', 'success');
        } else if (data.status === 'failed') {
          setJobStatus(`Failed: ${data.error}`);
          pushToast(`Server error: ${data.error}`, 'error');
          setSending(false);
        }
      });

    } catch (err) {
      setJobStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      pushToast(`Send failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setSending(false);
    }
  }, [pages, config, pushToast]);

  const handleDownload = useCallback(async () => {
    if (!jobId) return;
    try {
      const blob = await downloadResult(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scanforge-${jobId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast('Download started!', 'success');
    } catch (err) {
      pushToast(`Download failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [jobId, pushToast]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <DatabaseIcon size={16} />
          <span className="text-sm font-semibold text-zinc-200">Сервер телефона</span>
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Server Config */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <label className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfigState({ ...config, enabled: e.target.checked })}
                className="accent-indigo-500"
              />
              Сервер включён
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500">Хост</label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfigState({ ...config, host: e.target.value })}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500">Порт</label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfigState({ ...config, port: parseInt(e.target.value) || 8765 })}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          {jobId && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Job:</span>
                <span className="text-[10px] font-mono text-zinc-500">{jobId.slice(0, 8)}</span>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300">{jobStatus}</span>
                  <span className="text-zinc-500">{Math.round(jobProgress * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.max(2, jobProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {!sending && !jobDone && (
              <button
                onClick={handleSend}
                disabled={!config.enabled || pages.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500/20 py-2 text-[11px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:opacity-40"
              >
                <DatabaseIcon size={14} />
                Отправить ({pages.length} стр.)
              </button>
            )}

            {sending && !jobDone && (
              <div className="flex-1 rounded-md bg-zinc-800 py-2 text-center text-[11px] text-zinc-500">
                Отправка...
              </div>
            )}

            {jobDone && (
              <button
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-500/20 py-2 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30"
              >
                <DownloadIcon size={14} />
                Скачать ZIP
              </button>
            )}

            {jobDone && (
              <button
                onClick={() => { setJobId(null); setSending(false); setJobDone(false); }}
                className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-[11px] text-zinc-400 hover:bg-zinc-700"
              >
                Назад
              </button>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-zinc-600">
            Запусти сервер на телефоне: <code className="text-zinc-500">cd server && python main.py</code>
          </p>
        </div>
      </div>
    </div>
  );
}
