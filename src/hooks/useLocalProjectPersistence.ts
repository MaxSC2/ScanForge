import { useEffect, useMemo, useRef } from 'react';
import type { ProjectMeta } from '../types';
import { getProjectRepository } from '../storage';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { usePageStore } from '../stores/usePageStore';
import { useProjectLibraryStore } from '../stores/useProjectLibraryStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useToastStore } from '../stores/useToastStore';
import { hydrateProjectFile } from '../utils/persistence';

const AUTOSAVE_DELAY_MS = 1500;

function buildPersistenceToken(
  meta: ProjectMeta,
  pageCount: number,
  activePageId: string | null,
) {
  return `${meta.localProjectId ?? 'draft'}:${meta.updatedAt}:${pageCount}:${activePageId ?? 'none'}`;
}

export function useLocalProjectPersistence() {
  const pages = usePageStore((s) => s.pages);
  const activePageId = usePageStore((s) => s.activePageId);
  const setProjectState = usePageStore((s) => s.setProjectState);
  const meta = useProjectStore((s) => s.meta);
  const setMeta = useProjectStore((s) => s.setMeta);
  const clearHistory = useHistoryStore((s) => s.clear);
  const requestFitToPage = useEditorStore((s) => s.requestFitToPage);
  const pushToast = useToastStore((s) => s.push);
  const repository = useMemo(() => getProjectRepository(), []);
  const isRestoringRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastPersistedTokenRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const current = usePageStore.getState();
        if (current.pages.length > 0) return;

        const project = await repository.loadLatestProject();
        if (!project || cancelled) return;

        isRestoringRef.current = true;
        const hydrated = await hydrateProjectFile(project);
        if (cancelled) return;

        setMeta(hydrated.meta);
        setProjectState({
          pages: hydrated.pages,
          activePageId: hydrated.activePageId,
        });
        clearHistory();
        lastPersistedTokenRef.current = buildPersistenceToken(
          hydrated.meta,
          hydrated.pages.length,
          hydrated.activePageId,
        );
        void useProjectLibraryStore.getState().refresh();
        requestFitToPage();
        pushToast('Восстановлен локальный снимок проекта', 'info');
      } catch (error) {
        console.warn('Local project restore skipped:', error);
      } finally {
        isRestoringRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearHistory, pushToast, repository, requestFitToPage, setMeta, setProjectState]);

  useEffect(() => {
    const token = buildPersistenceToken(meta, pages.length, activePageId);
    if (pages.length === 0 && !meta.localProjectId) return;
    if (isRestoringRef.current) return;
    if (token === lastPersistedTokenRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const project = await usePageStore.getState().toProjectFile();
          const result = await repository.saveProject(project);
          const current = usePageStore.getState();
          lastPersistedTokenRef.current = buildPersistenceToken(
            result.project.meta,
            current.pages.length,
            current.activePageId,
          );

          if (useProjectStore.getState().meta.localProjectId !== result.project.meta.localProjectId) {
            useProjectStore.getState().setMeta(result.project.meta);
          }
          void useProjectLibraryStore.getState().refresh();
        } catch (error) {
          console.warn('Local project autosave failed:', error);
        }
      })();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [activePageId, meta, pages.length, repository]);
}
