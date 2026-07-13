import { useState } from 'react';
import { XIcon } from '../icons';
import { useCollabStore } from '../collaboration/store';
import { connectCollab, disconnectCollab } from '../collaboration/sync';
import { useT } from '../i18n';

export function CollabDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const connected = useCollabStore((s) => s.connected);
  const reconnecting = useCollabStore((s) => s.reconnecting);
  const users = useCollabStore((s) => s.users);
  const serverUrl = useCollabStore((s) => s.serverUrl);
  const userName = useCollabStore((s) => s.userName);
  const setServerUrl = useCollabStore((s) => s.setServerUrl);
  const setUserName = useCollabStore((s) => s.setUserName);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [nameInput, setNameInput] = useState(userName);

  if (!open) return null;

  const handleConnect = () => {
    setServerUrl(urlInput);
    setUserName(nameInput);
    connectCollab(urlInput);
  };

  const handleDisconnect = () => {
    disconnectCollab();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">{t('collab.title')}</span>
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
            <XIcon size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">{t('collab.server')}</label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t('collab.serverPlaceholder')}
              disabled={connected}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 disabled:opacity-40"
            />
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">{t('collab.username')}</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t('collab.usernamePlaceholder')}
              disabled={connected}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 disabled:opacity-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : reconnecting ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-[11px] text-zinc-400">
              {connected ? t('collab.connected') : reconnecting ? t('collab.reconnecting') : t('collab.disconnected')}
            </span>
          </div>

          {users.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
              <p className="mb-1 text-[10px] font-medium text-zinc-500">{t('collab.users', { count: users.length })}</p>
              <div className="space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                    <span className="text-[11px] text-zinc-300">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {connected ? (
              <button
                onClick={handleDisconnect}
                className="flex-1 rounded-md bg-red-500/20 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/30"
              >
                {t('collab.disconnect')}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!urlInput.trim()}
                className="flex-1 rounded-md bg-emerald-500/20 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40"
              >
                {reconnecting ? t('collab.reconnecting') : t('collab.connect')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
