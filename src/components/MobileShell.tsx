import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from '../icons';
import { useEditorStore } from '../stores/useEditorStore';
import { usePageStore } from '../stores/usePageStore';
import { useMobileStore } from '../stores/useMobileStore';
import { usePinchZoom } from '../hooks/usePinchZoom';

interface MobileShellProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  toolbar: ReactNode;
  statusBar: ReactNode;
}

const BOTTOM_NAV_H = 56;

export function MobileShell({ sidebar, canvas, inspector, toolbar, statusBar }: MobileShellProps) {
  const sidebarSheet = useMobileStore((s) => s.sidebarSheet);
  const inspectorSheet = useMobileStore((s) => s.inspectorSheet);
  const setSidebarSheet = useMobileStore((s) => s.setSidebarSheet);
  const setInspectorSheet = useMobileStore((s) => s.setInspectorSheet);
  const [showNav, setShowNav] = useState(true);
  const [safeBottom, setSafeBottom] = useState(0);

  const pages = usePageStore((s) => s.pages);
  const activePageId = usePageStore((s) => s.activePageId);
  const goToAdjacentPage = usePageStore((s) => s.goToAdjacentPage);
  const cleanView = useEditorStore((s) => s.cleanView);
  const toggleCleanView = useEditorStore((s) => s.toggleCleanView);
  const regionOverlaysVisible = useEditorStore((s) => s.regionOverlaysVisible);
  const toggleRegionOverlays = useEditorStore((s) => s.toggleRegionOverlays);

  const activeIdx = activePageId ? pages.findIndex((p) => p.id === activePageId) : -1;

  // close sheets when page or region changes
  useEffect(() => { setSidebarSheet(false); }, [activePageId, setSidebarSheet]);
  useEffect(() => { setInspectorSheet(false); }, [activePageId, setInspectorSheet]);
  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx >= 0 && activeIdx < pages.length - 1;
  const pageLabel = pages.length === 0 || activeIdx < 0
    ? '—'
    : `${activeIdx + 1} / ${pages.length}`;

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  usePinchZoom(canvasAreaRef);

  // safe-area-inset-bottom
  useEffect(() => {
    const el = document.documentElement;
    const val = getComputedStyle(el).getPropertyValue('--sat') || '0px';
    setSafeBottom(parseInt(val, 10) || 0);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (cleanView) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0 && hasNext) goToAdjacentPage('next');
      if (dx > 0 && hasPrev) goToAdjacentPage('previous');
    },
    [cleanView, hasNext, hasPrev, goToAdjacentPage],
  );

  useEffect(() => {
    const main = document.querySelector<HTMLDivElement>('[data-canvas-area]');
    if (!main) return;
    const opts: AddEventListenerOptions = { passive: true };
    main.addEventListener('touchstart', handleTouchStart as EventListener, opts);
    main.addEventListener('touchend', handleTouchEnd as EventListener, opts);
    return () => {
      main.removeEventListener('touchstart', handleTouchStart as EventListener);
      main.removeEventListener('touchend', handleTouchEnd as EventListener);
    };
  }, [handleTouchStart, handleTouchEnd]);

  // auto-hide nav on canvas interaction
  useEffect(() => {
    if (!cleanView) { setShowNav(true); return; }
    const t = setTimeout(() => setShowNav(false), 2000);
    return () => clearTimeout(t);
  }, [cleanView]);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-zinc-950 text-zinc-100 safe-area">
      {/* Canvas */}
      <div
        ref={canvasAreaRef}
        data-canvas-area
        className="relative flex-1 overflow-hidden"
      >
        {canvas}
      </div>

      {/* Status bar on canvas bottom */}
      {!cleanView && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] text-zinc-600">{pageLabel}</span>
          {statusBar}
        </div>
      )}

      {/* Bottom navigation */}
      <nav
        className="relative z-40 flex items-center justify-around border-t border-zinc-800 bg-zinc-900/98 backdrop-blur-lg transition-transform duration-300"
        style={{
          height: BOTTOM_NAV_H + safeBottom,
          paddingBottom: safeBottom,
          transform: showNav ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {toolbar}
      </nav>

      {/* Sheet overlay */}
      {(sidebarSheet || inspectorSheet) && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => { setSidebarSheet(false); setInspectorSheet(false); }}
        />
      )}

      {/* Sidebar sheet (left) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900/98 px-3 pb-4 pt-3 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
          sidebarSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: safeBottom + 12 }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
        {sidebar}
      </div>

      {/* Inspector sheet (right) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900/98 px-3 pb-4 pt-3 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
          inspectorSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: safeBottom + 12 }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
        {inspector}
      </div>

      {/* Floating clean-mode controls */}
      {cleanView && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/78 px-2 py-1 text-[11px] text-zinc-400 shadow-2xl backdrop-blur">
            <button onClick={() => goToAdjacentPage('previous')} disabled={!hasPrev}
              className="flex h-9 w-9 items-center justify-center rounded-full active:bg-zinc-800 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 px-2 text-center tabular-nums text-zinc-300">{pageLabel}</span>
            <button onClick={() => goToAdjacentPage('next')} disabled={!hasNext}
              className="flex h-9 w-9 items-center justify-center rounded-full active:bg-zinc-800 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            <button onClick={toggleRegionOverlays} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-zinc-800">
              {regionOverlaysVisible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
            </button>
            <button onClick={toggleCleanView} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 active:bg-zinc-700">
              <XIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
