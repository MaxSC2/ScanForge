import { useEffect, useMemo, useRef } from 'react';
import type { ProjectMeta } from '../types';
import { formatDiagnosticError } from '../services/diagnostics';
import { getProjectRepository } from '../storage';
import { useDiagnosticsStore } from '../stores/useDiagnosticsStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';
import { useProjectDomainStore } from '../stores/useProjectDomainStore';
import { useProjectLibraryStore } from '../stores/useProjectLibraryStore';
import { usePersistenceStore } from '../stores/usePersistenceStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useToastStore } from '../stores/useToastStore';
import {
  mergePagesWithRepository,
  mergeRegionsWithRepository,
  syncPagesForProject,
  syncRegionsForPages,
} from '../repositories';
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

        const loadResult = await repository.loadLatestProject();
        if (!loadResult || cancelled) return;

        isRestoringRef.current = true;
        const hydrated = await hydrateProjectFile(loadResult.project);
        if (cancelled) return;
        const pagesWithDomainAssets = await mergePagesWithRepository(hydrated.meta, hydrated.pages);
        const pages = await mergeRegionsWithRepository(pagesWithDomainAssets);
        const activePageId = pages.some((page) => page.id === hydrated.activePageId)
          ? hydrated.activePageId
          : pages[0]?.id ?? null;

        setMeta(hydrated.meta);
        setProjectState({
          pages,
          activePageId,
        });
        await useDiagnosticsStore.getState().hydrateProject(hydrated.meta.localProjectId);
        await useProjectDomainStore.getState().hydrateProjectDomain(
          hydrated.meta.localProjectId,
        );
        await useJobStore.getState().loadJobsForCurrentProject();
        clearHistory();
        usePersistenceStore.getState().markSaved(hydrated.meta.updatedAt);
        usePersistenceStore.getState().setRecoveryNotice(loadResult.warning ?? null);
        lastPersistedTokenRef.current = buildPersistenceToken(
          hydrated.meta,
          pages.length,
          activePageId,
        );
        void useProjectLibraryStore.getState().refresh();
        requestFitToPage();
        if (loadResult.warning) {
          useDiagnosticsStore.getState().record({
            scope: 'recovery',
            level: 'warning',
            message: 'Project restored with recovery warning',
            detail: loadResult.warning,
            ...(hydrated.meta.localProjectId ? { projectId: hydrated.meta.localProjectId } : {}),
          });
          pushToast(loadResult.warning, 'warning');
        }
        pushToast('Восстановлен локальный снимок проекта', 'info');
      } catch (error) {
        console.warn('Local project restore skipped:', error);
        useDiagnosticsStore.getState().record({
          scope: 'recovery',
          level: 'error',
          message: 'Automatic project restore failed',
          detail: formatDiagnosticError(error, 'Local project restore skipped'),
          ...(useProjectStore.getState().meta.localProjectId
            ? { projectId: useProjectStore.getState().meta.localProjectId }
            : {}),
        });
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
    usePersistenceStore.getState().markPending();

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          usePersistenceStore.getState().markSaving();
          const project = await usePageStore.getState().toProjectFile();
          const result = await repository.saveProject(project);
          const current = usePageStore.getState();
          await syncPagesForProject(result.project.meta, current.pages);
          await syncRegionsForPages(current.pages);
          lastPersistedTokenRef.current = buildPersistenceToken(
            result.project.meta,
            current.pages.length,
            current.activePageId,
          );

          if (useProjectStore.getState().meta.localProjectId !== result.project.meta.localProjectId) {
            useProjectStore.getState().setMeta(result.project.meta);
          }
          await useProjectDomainStore.getState().hydrateProjectDomain(
            result.project.meta.localProjectId,
          );
          void useProjectLibraryStore.getState().refresh();
          usePersistenceStore.getState().markSaved(result.project.meta.updatedAt);
        } catch (error) {
          console.warn('Local project autosave failed:', error);
          useDiagnosticsStore.getState().record({
            scope: 'autosave',
            level: 'error',
            message: 'Local project autosave failed',
            detail: formatDiagnosticError(error, 'Local project autosave failed'),
            ...(useProjectStore.getState().meta.localProjectId
              ? { projectId: useProjectStore.getState().meta.localProjectId }
              : {}),
          });
          usePersistenceStore
            .getState()
            .markError(error instanceof Error ? error.message : 'Local project autosave failed');
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
