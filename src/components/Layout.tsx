import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from '../icons';
import { useEditorStore } from '../stores/useEditorStore';
import { usePageStore } from '../stores/usePageStore';

interface LayoutProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  toolbar: ReactNode;
  statusBar: ReactNode;
}

const CLEAN_HUD_IDLE_MS = 1800;

export function Layout({ sidebar, canvas, inspector, toolbar, statusBar }: LayoutProps) {
  const [cleanHudVisible, setCleanHudVisible] = useState(true);
  const [inspectorResizing, setInspectorResizing] = useState(false);

  const pages = usePageStore((state) => state.pages);
  const activePageId = usePageStore((state) => state.activePageId);
  const goToAdjacentPage = usePageStore((state) => state.goToAdjacentPage);
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen);
  const inspectorWidth = useEditorStore((state) => state.inspectorWidth);
  const focusMode = useEditorStore((state) => state.focusMode);
  const cleanView = useEditorStore((state) => state.cleanView);
  const regionOverlaysVisible = useEditorStore((state) => state.regionOverlaysVisible);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);
  const setInspectorWidth = useEditorStore((state) => state.setInspectorWidth);
  const toggleCleanView = useEditorStore((state) => state.toggleCleanView);
  const toggleRegionOverlays = useEditorStore((state) => state.toggleRegionOverlays);
  const requestFitToPage = useEditorStore((state) => state.requestFitToPage);

  const hideHudTimerRef = useRef<number | null>(null);

  const sidebarWidth = 224;
  const activePageIndex = activePageId ? pages.findIndex((page) => page.id === activePageId) : -1;
  const hasPreviousPage = activePageIndex > 0;
  const hasNextPage = activePageIndex >= 0 && activePageIndex < pages.length - 1;
  const pageCounterLabel =
    pages.length === 0 || activePageIndex < 0 ? 'Нет страниц' : `${activePageIndex + 1} / ${pages.length}`;

  const clearHideHudTimer = useCallback(() => {
    if (hideHudTimerRef.current !== null) {
      window.clearTimeout(hideHudTimerRef.current);
      hideHudTimerRef.current = null;
    }
  }, []);

  const scheduleCleanHudHide = useCallback(() => {
    clearHideHudTimer();
    if (!cleanView) {
      setCleanHudVisible(true);
      return;
    }

    hideHudTimerRef.current = window.setTimeout(() => {
      setCleanHudVisible(false);
    }, CLEAN_HUD_IDLE_MS);
  }, [cleanView, clearHideHudTimer]);

  const revealCleanHud = useCallback(() => {
    setCleanHudVisible(true);
    if (cleanView) {
      scheduleCleanHudHide();
    }
  }, [cleanView, scheduleCleanHudHide]);

  useEffect(() => {
    if (!cleanView) {
      clearHideHudTimer();
      setCleanHudVisible(true);
      return;
    }

    revealCleanHud();

    const handleKeyboardActivity = () => {
      revealCleanHud();
    };

    window.addEventListener('keydown', handleKeyboardActivity);
    return () => {
      window.removeEventListener('keydown', handleKeyboardActivity);
      clearHideHudTimer();
    };
  }, [cleanView, clearHideHudTimer, revealCleanHud]);

  useEffect(() => {
    if (!inspectorResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setInspectorWidth(nextWidth);
    };

    const stopResizing = () => {
      setInspectorResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, [inspectorResizing, setInspectorWidth]);

  const startInspectorResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!inspectorOpen || cleanView) return;
    event.preventDefault();
    setInspectorResizing(true);
  }, [cleanView, inspectorOpen]);

  return (
    <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {!cleanView && (
        <header className="relative z-40 flex h-11 flex-none items-center gap-2 overflow-visible border-b border-zinc-800 bg-zinc-900/95 px-3 backdrop-blur-sm">
          {toolbar}
        </header>
      )}

      <div className="relative flex min-h-0 flex-1">
        {!cleanView && (
          <aside
            className={`overflow-hidden bg-zinc-900 transition-[width,transform,opacity] duration-200 ease-out ${
              focusMode
                ? 'absolute bottom-0 left-0 top-0 z-30 border-r border-zinc-800 shadow-2xl shadow-black/40'
                : 'flex-none border-r border-zinc-800'
            }`}
            style={{ width: sidebarOpen ? sidebarWidth : 0 }}
          >
            <div className="h-full overflow-y-auto" style={{ width: sidebarWidth }}>
              {sidebar}
            </div>
          </aside>
        )}

        {!cleanView && !focusMode && (
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Свернуть левую панель' : 'Развернуть левую панель'}
            className="flex w-5 flex-none items-center justify-center border-r border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title={sidebarOpen ? 'Свернуть левую панель (Ctrl+B)' : 'Развернуть левую панель (Ctrl+B)'}
          >
            {sidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
          </button>
        )}

        <main
          className={`group relative flex-1 overflow-hidden ${cleanView ? 'bg-black' : 'bg-zinc-950'}`}
          onPointerMove={cleanView ? revealCleanHud : undefined}
          onPointerDown={cleanView ? revealCleanHud : undefined}
          onWheel={cleanView ? revealCleanHud : undefined}
        >
          {cleanView && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(39,39,42,0.2)_0%,rgba(9,9,11,0.78)_56%,rgba(0,0,0,1)_100%)]" />
              <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-indigo-950/15 via-transparent to-transparent" />
              <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-cyan-950/10 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/65 to-transparent" />
            </div>
          )}

          {focusMode && !cleanView && (
            <>
              <button
                onClick={toggleSidebar}
                aria-label={sidebarOpen ? 'Скрыть левую панель' : 'Показать левую панель'}
                className="absolute left-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/92 text-zinc-500 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title={sidebarOpen ? 'Скрыть левую панель (Ctrl+B)' : 'Показать левую панель (Ctrl+B)'}
              >
                {sidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
              </button>

              <button
                onClick={toggleInspector}
                aria-label={inspectorOpen ? 'Скрыть инспектор' : 'Показать инспектор'}
                className="absolute right-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/92 text-zinc-500 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title={inspectorOpen ? 'Скрыть инспектор (Ctrl+I)' : 'Показать инспектор (Ctrl+I)'}
              >
                {inspectorOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              </button>

              {(sidebarOpen || inspectorOpen) && (
                <button
                  onClick={() => {
                    if (sidebarOpen) toggleSidebar();
                    if (inspectorOpen) toggleInspector();
                  }}
                  className="absolute inset-0 z-20 bg-black/20"
                  aria-label="Закрыть наложенные панели"
                />
              )}
            </>
          )}

          {cleanView && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4">
              <div
                className={`pointer-events-auto flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/78 p-1 text-[11px] text-zinc-400 shadow-2xl shadow-black/40 backdrop-blur transition-all duration-300 ${
                  cleanHudVisible
                    ? 'translate-y-0 opacity-100'
                    : '-translate-y-3 opacity-0'
                }`}
              >
                <span className="px-2 uppercase tracking-[0.18em] text-zinc-500">Чистый режим</span>

                <button
                  onClick={() => goToAdjacentPage('previous')}
                  disabled={!hasPreviousPage}
                  aria-label="Предыдущая страница"
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Предыдущая страница (Left / Up / PageUp)"
                >
                  <ChevronLeft size={13} />
                </button>

                <span className="min-w-16 px-1 text-center tabular-nums text-zinc-300">
                  {pageCounterLabel}
                </span>

                <button
                  onClick={() => goToAdjacentPage('next')}
                  disabled={!hasNextPage}
                  aria-label="Следующая страница"
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Следующая страница (Right / Down / Space)"
                >
                  <ChevronRight size={13} />
                </button>

                <button
                  onClick={requestFitToPage}
                  className="rounded-full px-2.5 py-1 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                  title="Подогнать страницу в окно"
                >
                  Вписать
                </button>

                <button
                  onClick={toggleRegionOverlays}
                  aria-label={regionOverlaysVisible ? 'Скрыть оверлеи регионов' : 'Показать оверлеи регионов'}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                  title={regionOverlaysVisible ? 'Скрыть оверлеи регионов' : 'Показать оверлеи регионов'}
                >
                  {regionOverlaysVisible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
                </button>

                <button
                  onClick={toggleCleanView}
                  aria-label="Выйти из чистого режима"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-200 transition-colors hover:bg-zinc-700"
                  title="Выйти из чистого режима (Esc)"
                >
                  <XIcon size={13} />
                </button>
              </div>
            </div>
          )}

          <div className="relative z-10 h-full">{canvas}</div>
        </main>

        {!cleanView && !focusMode && (
          <button
            onClick={toggleInspector}
            aria-label={inspectorOpen ? 'Свернуть инспектор' : 'Развернуть инспектор'}
            className="flex w-5 flex-none items-center justify-center border-l border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title={inspectorOpen ? 'Свернуть инспектор (Ctrl+I)' : 'Развернуть инспектор (Ctrl+I)'}
          >
            {inspectorOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
          </button>
        )}

        {!cleanView && inspectorOpen && !focusMode && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину инспектора"
            onPointerDown={startInspectorResize}
            className={`group relative w-1.5 flex-none cursor-col-resize bg-zinc-900 transition-colors ${
              inspectorResizing ? 'bg-indigo-500/30' : 'hover:bg-zinc-800'
            }`}
            title="Потяни, чтобы изменить ширину инспектора"
          >
            <div
              className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
                inspectorResizing ? 'bg-indigo-400/80' : 'bg-zinc-800 group-hover:bg-zinc-600'
              }`}
            />
          </div>
        )}

        {!cleanView && (
          <aside
            className={`overflow-hidden bg-zinc-900 ${
              inspectorResizing
                ? 'transition-none'
                : 'transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
            } ${
              focusMode
                ? 'absolute bottom-0 right-0 top-0 z-30 border-l border-zinc-800 shadow-2xl shadow-black/40'
                : 'flex-none border-l border-zinc-800'
            }`}
            style={{ width: inspectorOpen ? inspectorWidth : 0 }}
          >
            <div
              className={`h-full overflow-y-auto ${
                inspectorResizing
                  ? 'transition-none'
                  : 'transition-[opacity,transform] duration-200 ease-out'
              } ${inspectorOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-2 opacity-0'}`}
              style={{ width: inspectorWidth }}
            >
              {inspector}
            </div>
          </aside>
        )}
      </div>

      {!cleanView && statusBar}
    </div>
  );
}
