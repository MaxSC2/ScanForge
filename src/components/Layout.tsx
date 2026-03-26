import type { ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEditorStore } from '../stores/useEditorStore';

interface LayoutProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  toolbar: ReactNode;
  statusBar: ReactNode;
}

export function Layout({ sidebar, canvas, inspector, toolbar, statusBar }: LayoutProps) {
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen);
  const focusMode = useEditorStore((state) => state.focusMode);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);

  const sidebarWidth = 224;
  const inspectorWidth = 272;

  return (
    <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex h-11 flex-none items-center gap-2 border-b border-zinc-800 bg-zinc-900/95 px-3 backdrop-blur-sm">
        {toolbar}
      </header>

      <div className="relative flex min-h-0 flex-1">
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

        {!focusMode && (
          <button
            onClick={toggleSidebar}
            className="flex w-5 flex-none items-center justify-center border-r border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title={sidebarOpen ? 'Свернуть левую панель (Ctrl+B)' : 'Развернуть левую панель (Ctrl+B)'}
          >
            {sidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
          </button>
        )}

        <main className="relative flex-1 overflow-hidden bg-zinc-950">
          {focusMode && (
            <>
              <button
                onClick={toggleSidebar}
                className="absolute left-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/92 text-zinc-500 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title={sidebarOpen ? 'Hide left panel (Ctrl+B)' : 'Show left panel (Ctrl+B)'}
              >
                {sidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
              </button>

              <button
                onClick={toggleInspector}
                className="absolute right-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/92 text-zinc-500 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title={inspectorOpen ? 'Hide inspector (Ctrl+I)' : 'Show inspector (Ctrl+I)'}
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
                  aria-label="Close overlay panels"
                />
              )}
            </>
          )}

          {canvas}
        </main>

        {!focusMode && (
          <button
            onClick={toggleInspector}
            className="flex w-5 flex-none items-center justify-center border-l border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title={inspectorOpen ? 'Свернуть инспектор (Ctrl+I)' : 'Развернуть инспектор (Ctrl+I)'}
          >
            {inspectorOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
          </button>
        )}

        <aside
          className={`overflow-hidden bg-zinc-900 transition-[width,transform,opacity] duration-200 ease-out ${
            focusMode
              ? 'absolute bottom-0 right-0 top-0 z-30 border-l border-zinc-800 shadow-2xl shadow-black/40'
              : 'flex-none border-l border-zinc-800'
          }`}
          style={{ width: inspectorOpen ? inspectorWidth : 0 }}
        >
          <div className="h-full overflow-y-auto" style={{ width: inspectorWidth }}>
            {inspector}
          </div>
        </aside>
      </div>

      {statusBar}
    </div>
  );
}
