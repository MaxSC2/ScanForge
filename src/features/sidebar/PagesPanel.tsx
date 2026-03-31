import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  GripVertical,
  ImagePlus,
  Layers,
  Trash2,
} from 'lucide-react';
import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';

export function PagesPanel() {
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

      {pages.length > 0 ? (
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
      ) : null}

      {pages.length === 0 ? (
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
      ) : null}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="pages-list">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="min-h-0 flex-1 overflow-y-auto"
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
                              {page.naturalWidth}x{page.naturalHeight}
                            </p>
                            {page.regions.length > 0 ? (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
                                  <Layers size={8} />
                                  {page.regions.length}
                                </span>
                              </div>
                            ) : null}
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
