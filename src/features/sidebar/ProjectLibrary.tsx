import { useEffect, useMemo } from 'react';
import {
  Clock3,
  LoaderCircle,
  RefreshCcw,
} from 'lucide-react';
import {
  DatabaseIcon,
  FolderOpenIcon,
  PlusIcon,
} from '../../icons';
import { useProjectLibraryStore } from '../../stores/useProjectLibraryStore';
import { useProjectStore } from '../../stores/useProjectStore';

function formatUpdatedAt(value: number) {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function ProjectLibrary() {
  const summaries = useProjectLibraryStore((state) => state.summaries);
  const loading = useProjectLibraryStore((state) => state.loading);
  const switchingProjectId = useProjectLibraryStore((state) => state.switchingProjectId);
  const refresh = useProjectLibraryStore((state) => state.refresh);
  const createProject = useProjectLibraryStore((state) => state.createProject);
  const loadProject = useProjectLibraryStore((state) => state.loadProject);
  const meta = useProjectStore((state) => state.meta);
  const setName = useProjectStore((state) => state.setName);
  const activeProjectId = meta.localProjectId ?? null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentProjectLabel = useMemo(() => {
    if (activeProjectId) return 'Локальный проект';
    return 'Черновик';
  }, [activeProjectId]);

  return (
    <section className="flex-none border-b border-zinc-800">
      <div className="flex items-center gap-2 px-3 py-2">
        <DatabaseIcon size={12} className="text-zinc-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex-1">
          Проекты
        </h2>
        <span className="text-[10px] text-zinc-600 tabular-nums">{summaries.length}</span>
      </div>

      <div className="px-2 pb-2 space-y-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-2">
            <FolderOpenIcon size={11} />
            <span>{currentProjectLabel}</span>
            {activeProjectId && (
              <span className="ml-auto truncate text-zinc-600">{activeProjectId.slice(0, 8)}</span>
            )}
          </div>

          <input
            value={meta.name}
            onChange={(event) => setName(event.target.value)}
            className="input-field"
            placeholder="Название проекта"
          />

          <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-600">
            <Clock3 size={10} />
            <span>Обновлён: {formatUpdatedAt(meta.updatedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => void createProject()}
            disabled={switchingProjectId !== null}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600/90 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {switchingProjectId === '__new__' ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : (
              <PlusIcon size={12} />
            )}
            Новый
          </button>

          <button
            onClick={() => void refresh()}
            disabled={loading || switchingProjectId !== null}
            aria-label="Обновить библиотеку проектов"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Обновить библиотеку проектов"
          >
            <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          {summaries.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] font-medium text-zinc-400">Локальных проектов пока нет</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Создай новый проект или открой существующий JSON, и он появится здесь.
              </p>
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto p-1">
              {summaries.map((summary) => {
                const isActive = summary.id === activeProjectId;
                const isSwitching = switchingProjectId === summary.id;
                return (
                  <li key={summary.id}>
                    <button
                      onClick={() => void loadProject(summary.id)}
                      disabled={switchingProjectId !== null}
                      className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-indigo-500/10 text-indigo-200 ring-1 ring-indigo-500/20'
                          : 'text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-zinc-500">
                          {isSwitching ? (
                            <LoaderCircle size={12} className="animate-spin" />
                          ) : (
                            <FolderOpenIcon size={12} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium">{summary.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
                            <span>{summary.pageCount} стр.</span>
                            <span>{formatUpdatedAt(summary.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
