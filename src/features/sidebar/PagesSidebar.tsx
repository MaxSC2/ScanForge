import { useEffect, useState, type ReactNode } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Database,
  GripVertical,
  ImagePlus,
  Layers,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectLibraryStore } from '../../stores/useProjectLibraryStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { JobsPanel } from './JobsPanel';
import { ProjectLibrary } from './ProjectLibrary';

type SidebarView = 'pages' | 'projects' | 'jobs';

export function PagesSidebar() {
  const [activeView, setActiveView] = useState<SidebarView>('pages');
  const refreshProjects = useProjectLibraryStore((state) => state.refresh);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarTabs activeView={activeView} onChange={setActiveView} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeView === 'projects' && (
          <div className="h-full overflow-y-auto">
            <ProjectLibrary />
          </div>
        )}

        {activeView === 'jobs' && (
          <div className="h-full overflow-y-auto">
            <JobsPanel />
          </div>
        )}

        {activeView === 'pages' && <PagesPanel />}
      </div>
    </div>
  );
}

function SidebarTabs({
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
    { id: 'jobs', label: 'Jobs', count: jobCount, icon: <Workflow size={13} /> },
  ];

  return (
    <div className="border-b border-zinc-800 px-2 py-2">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
        {items.map((item) => {
          const isActive = item.id === activeView;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`rounded-lg px-2 py-2 text-left transition-all ${
                isActive
                  ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/20'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
              title={item.label}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="truncate text-[10px] font-semibold uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-zinc-600">{item.count}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PagesPanel() {
  const pages = usePageStore((state) => state.pages);
  const activePageId = usePageStore((state) => state.activePageId);
  const selectedPageIds = usePageStore((state) => state.selectedPageIds);
  const selectPage = usePageStore((state) => state.selectPage);
  const removePage = usePageStore((state) => state.removePage);
  const reorderPage = usePageStore((state) => state.reorderPage);
  const clearPageSelection = usePageStore((state) => state.clearPageSelection);
  const selectAllPages = usePageStore((state) => state.selectAllPages);
  const selectRegion = useRegionStore((state) => state.selectRegion);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderPage(result.source.index, result.destination.index);
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center border-b border-zinc-800 px-3 py-2">
        <Layers size={12} className="mr-1.5 text-zinc-500" />
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Страницы
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-600">{pages.length}</span>
      </div>

      {pages.length > 0 && (
        <div className="flex items-center gap-1 border-b border-zinc-800/80 px-2 py-1.5 text-[10px]">
          <button
            onClick={selectAllPages}
            className="rounded px-1.5 py-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Выбрать все
          </button>
          <button
            onClick={clearPageSelection}
            className="rounded px-1.5 py-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Сброс
          </button>
          <span className="ml-auto tabular-nums text-zinc-600">Выбрано: {selectedPageIds.length}</span>
        </div>
      )}

      {pages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <ImagePlus size={20} className="text-zinc-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">Страниц пока нет</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Открой изображения или перетащи файлы на холст
            </p>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="pages-list">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 min-h-0 overflow-y-auto"
            >
              <ul className="flex flex-col gap-0.5 p-1">
                {pages.map((page, index) => {
                  const isActive = page.id === activePageId;
                  const isSelectedForBatch = selectedPageIds.includes(page.id);

                  return (
                    <Draggable key={page.id} draggableId={page.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <li
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-xs transition-all duration-150 ${
                            snapshot.isDragging
                              ? 'bg-zinc-700 shadow-lg shadow-black/30 ring-1 ring-indigo-500/30'
                              : isActive
                                ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20'
                                : isSelectedForBatch
                                  ? 'bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700'
                                  : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                          }`}
                          onClick={(event) => {
                            const mode = event.shiftKey
                              ? 'range'
                              : event.ctrlKey || event.metaKey
                                ? 'toggle'
                                : 'replace';
                            selectPage(page.id, mode);
                            selectRegion(null);
                          }}
                        >
                          <span
                            {...dragProvided.dragHandleProps}
                            className="cursor-grab px-0.5 text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
                          >
                            <GripVertical size={12} />
                          </span>

                          <input
                            type="checkbox"
                            checked={isSelectedForBatch}
                            onChange={() => selectPage(page.id, 'toggle')}
                            onClick={(event) => event.stopPropagation()}
                            className="accent-indigo-500"
                            title="Выбрать страницу для пакетных операций"
                          />

                          <img
                            src={page.imageUrl}
                            alt=""
                            className="h-12 w-9 flex-none rounded border border-zinc-700/50 object-cover"
                          />

                          <div className="min-w-0 flex-1 py-0.5">
                            <p className="truncate text-[11px] font-medium leading-tight">
                              {page.fileName}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-600">
                              {page.naturalWidth}×{page.naturalHeight}
                            </p>
                            {page.regions.length > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
                                  <Layers size={8} />
                                  {page.regions.length}
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              removePage(page.id);
                            }}
                            className="flex-none rounded p-1 text-zinc-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                            title="Удалить страницу"
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </ul>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </section>
  );
}
