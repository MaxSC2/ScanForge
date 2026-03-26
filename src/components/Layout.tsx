import type { ReactNode } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface LayoutProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  toolbar: ReactNode;
  statusBar: ReactNode;
}

export function Layout({ sidebar, canvas, inspector, toolbar, statusBar }: LayoutProps) {
  const sidebarOpen = useEditorStore((s) => s.sidebarOpen);
  const inspectorOpen = useEditorStore((s) => s.inspectorOpen);
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar);
  const toggleInspector = useEditorStore((s) => s.toggleInspector);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      {/* Top toolbar */}
      <header className="flex-none h-11 flex items-center gap-2 px-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
        {toolbar}
      </header>

      {/* Three-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside
          className="flex-none border-r border-zinc-800 bg-zinc-900 overflow-hidden transition-[width] duration-200 ease-out"
          style={{ width: sidebarOpen ? 240 : 0 }}
        >
          <div className="w-60 h-full overflow-y-auto">
            {sidebar}
          </div>
        </aside>

        {/* Sidebar collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="flex-none w-5 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border-r border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title={sidebarOpen ? 'Свернуть левую панель (Ctrl+B)' : 'Развернуть левую панель (Ctrl+B)'}
        >
          {sidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
        </button>

        {/* Center canvas area */}
        <main className="flex-1 relative overflow-hidden bg-zinc-950">
          {canvas}
        </main>

        {/* Inspector collapse toggle */}
        <button
          onClick={toggleInspector}
          className="flex-none w-5 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border-l border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title={inspectorOpen ? 'Свернуть инспектор (Ctrl+I)' : 'Развернуть инспектор (Ctrl+I)'}
        >
          {inspectorOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
        </button>

        {/* Right inspector */}
        <aside
          className="flex-none border-l border-zinc-800 bg-zinc-900 overflow-hidden transition-[width] duration-200 ease-out"
          style={{ width: inspectorOpen ? 296 : 0 }}
        >
          <div className="w-[296px] h-full overflow-y-auto">
            {inspector}
          </div>
        </aside>
      </div>

      {/* Status bar */}
      {statusBar}
    </div>
  );
}
