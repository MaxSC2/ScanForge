import type { ReactNode } from 'react';
import { Database, Layers, Workflow } from 'lucide-react';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectLibraryStore } from '../../stores/useProjectLibraryStore';

export type SidebarView = 'pages' | 'projects' | 'jobs';

export function SidebarTabs({
  activeView,
  onChange,
}: {
  activeView: SidebarView;
  onChange: (view: SidebarView) => void;
}) {
  const pageCount = usePageStore((state) => state.pages.length);
  const projectCount = useProjectLibraryStore((state) => state.summaries.length);
  const jobCount = useJobStore((state) => state.jobs.length);

  const items: {
    id: SidebarView;
    label: string;
    count: number;
    icon: ReactNode;
  }[] = [
    { id: 'pages', label: 'Страницы', count: pageCount, icon: <Layers size={13} /> },
    { id: 'projects', label: 'Проекты', count: projectCount, icon: <Database size={13} /> },
    { id: 'jobs', label: 'Задачи', count: jobCount, icon: <Workflow size={13} /> },
  ];

  return (
    <div className="border-b border-zinc-800 px-2 py-2">
      <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
        {items.map((item) => {
          const isActive = item.id === activeView;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-all ${
                isActive
                  ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/20'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
              title={item.label}
            >
              <span className="flex-none">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-wide">
                {item.label}
              </span>
              <span
                className={`flex-none rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${
                  isActive ? 'bg-indigo-500/10 text-indigo-200' : 'bg-zinc-900 text-zinc-600'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
