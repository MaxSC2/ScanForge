import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { GripVertical, Trash2, Layers, ImagePlus } from 'lucide-react';

export function PagesSidebar() {
  const pages = usePageStore((s) => s.pages);
  const activePageId = usePageStore((s) => s.activePageId);
  const selectedPageIds = usePageStore((s) => s.selectedPageIds);
  const selectPage = usePageStore((s) => s.selectPage);
  const removePage = usePageStore((s) => s.removePage);
  const reorderPage = usePageStore((s) => s.reorderPage);
  const clearPageSelection = usePageStore((s) => s.clearPageSelection);
  const selectAllPages = usePageStore((s) => s.selectAllPages);
  const selectRegion = useRegionStore((s) => s.selectRegion);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderPage(result.source.index, result.destination.index);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-zinc-800">
        <Layers size={12} className="text-zinc-500 mr-1.5" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex-1">
          Страницы
        </h2>
        <span className="text-[10px] text-zinc-600 tabular-nums">
          {pages.length}
        </span>
      </div>

      {pages.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800/80 text-[10px]">
          <button
            onClick={selectAllPages}
            className="px-1.5 py-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Выбрать все
          </button>
          <button
            onClick={clearPageSelection}
            className="px-1.5 py-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Сброс
          </button>
          <span className="ml-auto text-zinc-600 tabular-nums">
            Выбрано: {selectedPageIds.length}
          </span>
        </div>
      )}

      {/* Empty state */}
      {pages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <ImagePlus size={20} className="text-zinc-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">Страниц пока нет</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Открой изображения или перетащи файлы на холст
            </p>
          </div>
        </div>
      )}

      {/* Page list with drag & drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="pages-list">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 overflow-y-auto"
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
                          className={`group flex items-center gap-1.5 px-1 py-1 rounded-md cursor-pointer text-xs transition-all duration-150 ${
                            snapshot.isDragging
                              ? 'bg-zinc-700 shadow-lg shadow-black/30 ring-1 ring-indigo-500/30'
                              : isActive
                                ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20'
                                : isSelectedForBatch
                                  ? 'bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700'
                                  : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                          }`}
                          onClick={(e) => {
                            const mode = e.shiftKey
                              ? 'range'
                              : e.ctrlKey || e.metaKey
                                ? 'toggle'
                                : 'replace';
                            selectPage(page.id, mode);
                            selectRegion(null);
                          }}
                        >
                          {/* Drag handle */}
                          <span
                            {...dragProvided.dragHandleProps}
                            className="flex-none px-0.5 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical size={12} />
                          </span>

                          <input
                            type="checkbox"
                            checked={isSelectedForBatch}
                            onChange={() => selectPage(page.id, 'toggle')}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-indigo-500"
                            title="Выбрать страницу для пакетных операций"
                          />

                          {/* Thumbnail */}
                          <img
                            src={page.imageUrl}
                            alt=""
                            className="w-9 h-12 object-cover rounded border border-zinc-700/50 flex-none"
                          />

                          {/* Info */}
                          <div className="flex-1 min-w-0 py-0.5">
                            <p className="truncate font-medium text-[11px] leading-tight">
                              {page.fileName}
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">
                              {page.naturalWidth}×{page.naturalHeight}
                            </p>
                            {page.regions.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-zinc-800 text-[9px] text-zinc-400">
                                  <Layers size={8} />
                                  {page.regions.length}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removePage(page.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-none"
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
    </div>
  );
}
