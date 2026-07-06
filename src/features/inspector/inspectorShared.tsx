import { useMemo, useState, type ReactNode } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ChevronRight,
  GripVertical,
  MessageSquare,
} from 'lucide-react';
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  LayersIcon,
  LockIcon,
  ListOrderedIcon,
  ScanTextIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
  TypeIcon,
} from '../../icons';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getRegionColor, type Region, type RegionKind } from '../../types';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useRegionStore } from '../../stores/useRegionStore';

export type InspectorView = 'details' | 'regions' | 'pipeline';

export function InspectorHeader({
  count,
  activeView,
  onChange,
}: {
  count: number;
  activeView: InspectorView;
  onChange: (view: InspectorView) => void;
}) {
  return (
    <div className="border-b border-zinc-800 px-3 py-2">
      <div className="flex items-center gap-2">
        <SettingsIcon size={12} className="text-zinc-500" />
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Инспектор
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-600">Регионов: {count}</span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
        <InspectorTabButton
          active={activeView === 'details'}
          icon={<span className="text-[12px]">T</span>}
          label="Детали"
          onClick={() => onChange('details')}
        />
        <InspectorTabButton
          active={activeView === 'regions'}
          icon={<LayersIcon size={12} />}
          label="Регионы"
          onClick={() => onChange('regions')}
        />
        <InspectorTabButton
          active={activeView === 'pipeline'}
          icon={<SettingsIcon size={12} />}
          label="Пайплайн"
          onClick={() => onChange('pipeline')}
        />
      </div>
    </div>
  );
}

function InspectorTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/20'
          : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function InspectorEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-400">{title}</p>
        <p className="mt-1 text-[11px] text-zinc-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AccordionSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-800/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300"
      >
        {open ? <ChevronDownIcon size={12} /> : <ChevronRight size={12} />}
        {icon}
        <span className="flex-1 text-left">{title}</span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-zinc-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Math.round(Number(event.target.value)))}
        className="input-field text-center tabular-nums"
      />
    </label>
  );
}

export function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-400">
      {label}
    </span>
  );
}

export function RegionListPanel({
  regions,
  selectedId,
  pageId,
  fullHeight = false,
}: {
  regions: Region[];
  selectedId: string | null;
  pageId: string;
  fullHeight?: boolean;
}) {
  const [filter, setFilter] = useState('');
  const selectRegion = useRegionStore((state) => state.selectRegion);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const batchUpdateRegions = useRegionStore((state) => state.batchUpdateRegions);
  const reorderRegions = useRegionStore((state) => state.reorderRegions);

  if (regions.length === 0) return null;

  const orderedRegions = useMemo(() => {
    let list = [...regions].sort((first, second) => first.order - second.order);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.sourceText.toLowerCase().includes(q) ||
          r.translatedText.toLowerCase().includes(q) ||
          r.status.includes(q),
      );
    }
    return list;
  }, [regions, filter]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderRegions(pageId, result.source.index, result.destination.index);
  };

  return (
    <div
      className={`flex flex-col ${
        fullHeight ? 'min-h-0 flex-1' : 'max-h-56 flex-none border-t border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-1.5 px-3 py-2">
        <LayersIcon size={10} className="text-zinc-600" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Регионы
        </span>
        <span className="text-[10px] tabular-nums text-zinc-600">{regions.length}</span>
      </div>

      {regions.length > 4 && (
        <div className="relative px-2 pb-1.5">
          <SearchIcon size={10} className="pointer-events-none absolute left-3.5 top-1.5 text-zinc-600" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск..."
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1 pl-6 pr-2 text-[10px] text-zinc-300 placeholder-zinc-600"
          />
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`region-list-${pageId}`}>
          {(dropProvided) => (
            <ul
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className={`min-h-0 overflow-y-auto px-1 pb-1 ${fullHeight ? 'flex-1' : 'max-h-44'}`}
            >
              {orderedRegions.map((region, index) => {
                const isSelected = region.id === selectedId;
                const color = getRegionColor(region.kind);

                return (
                  <Draggable key={region.id} draggableId={region.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <li
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        onClick={(event) => selectRegion(region.id, event.shiftKey)}
                        className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-all duration-100 ${
                          snapshot.isDragging
                            ? 'bg-zinc-700 ring-1 ring-indigo-500/30'
                            : isSelected
                              ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20'
                              : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                        }`}
                      >
                        <span {...dragProvided.dragHandleProps}>
                          <GripVertical size={10} className="flex-none text-zinc-600" />
                        </span>

                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: color }}
                        />

                        <span className="flex-1 truncate">
                          {region.order}. {region.label}
                        </span>

                        {region.locked ? <LockIcon size={10} className="flex-none text-amber-500/60" /> : null}
                        {!region.visible ? <EyeOffIcon size={10} className="flex-none text-zinc-600" /> : null}

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            updateRegion(pageId, region.id, { visible: !region.visible });
                          }}
                          aria-label={region.visible ? 'Скрыть регион' : 'Показать регион'}
                          className="flex-none p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                        >
                          {region.visible ? <EyeIcon size={10} /> : <EyeOffIcon size={10} />}
                        </button>

                        <span className="flex-none text-[10px] tabular-nums text-zinc-600">
                          {region.width}x{region.height}
                        </span>
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {dropProvided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      <MultiSelectActions pageId={pageId} regions={regions} />

      <BatchRegionActions pageId={pageId} regions={regions} />
    </div>
  );
}

function MultiSelectActions({
  pageId,
  regions,
}: {
  pageId: string;
  regions: Region[];
}) {
  const multiSelectedRegionIds = useRegionStore((s) => s.multiSelectedRegionIds);
  const clearMultiSelect = useRegionStore((s) => s.clearMultiSelect);

  if (multiSelectedRegionIds.length < 2) return null;

  const selected = regions.filter((r) => multiSelectedRegionIds.includes(r.id));
  if (selected.length < 2) return null;

  return (
    <div className="border-t border-zinc-800/60 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-indigo-400">
          Выбрано: {selected.length}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() =>
              useRegionStore.getState().batchUpdateRegions(
                pageId,
                selected.map((r) => r.id),
                { locked: !selected.every((r) => r.locked) },
              )
            }
            className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            {selected.every((r) => r.locked) ? 'Разблок.' : 'Заблок.'}
          </button>
          <button
            onClick={() => {
              const nextKind =
                selected.every((r) => r.kind === 'speech')
                  ? 'thought' as const
                  : 'speech' as const;
              useRegionStore.getState().batchUpdateRegions(
                pageId,
                selected.map((r) => r.id),
                { kind: nextKind },
              );
            }}
            className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Сменить тип
          </button>
          <button
            onClick={clearMultiSelect}
            className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
          >
            Сброс
          </button>
        </div>
      </div>
    </div>
  );
}

export function BatchRegionActions({
  pageId,
  regions,
}: {
  pageId: string;
  regions: Region[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const batchUpdateRegions = useRegionStore((state) => state.batchUpdateRegions);

  if (regions.length === 0) return null;

  const batchDelete = () => {
    useHistoryStore.getState().capture();
    const del = useRegionStore.getState().deleteRegion;
    for (const region of regions) {
      del(pageId, region.id);
    }
  };

  const autoNumber = () => {
    useHistoryStore.getState().capture();
    const sorted = [...regions].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    const pageStore = usePageStore.getState();
    pageStore.setState({
      pages: pageStore.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              regions: sorted.map((r, i) => ({
                ...r,
                order: i + 1,
              })),
            }
          : p,
      ),
    });
    useProjectStore.getState().touch();
  };

  const allLocked = regions.every((r) => r.locked);
  const allVisible = regions.every((r) => r.visible);
  const noneOcr = regions.every((r) => !r.sourceText);

  return (
    <div className="border-t border-zinc-800/60">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300"
      >
        {expanded ? <ChevronDownIcon size={11} /> : <ChevronRight size={11} />}
        <SettingsIcon size={11} />
        <span className="flex-1 text-left">Пакетные действия ({regions.length})</span>
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          <BatchActionButton
            icon={allLocked ? <LockIcon size={11} /> : <LockIcon size={11} />}
            label={allLocked ? 'Разблокировать все' : 'Заблокировать все'}
            onClick={() => batchUpdateRegions(pageId, regions.map((r) => r.id), { locked: !allLocked })}
          />
          <BatchActionButton
            icon={allVisible ? <EyeIcon size={11} /> : <EyeOffIcon size={11} />}
            label={allVisible ? 'Скрыть все' : 'Показать все'}
            onClick={() => batchUpdateRegions(pageId, regions.map((r) => r.id), { visible: !allVisible })}
          />
          <BatchActionButton
            icon={<TypeIcon size={11} />}
            label="В баблы"
            onClick={() => batchUpdateRegions(pageId, regions.map((r) => r.id), { kind: 'speech' })}
          />
          <BatchActionButton
            icon={<TypeIcon size={11} />}
            label="В мысли"
            onClick={() => batchUpdateRegions(pageId, regions.map((r) => r.id), { kind: 'thought' })}
          />
          <BatchActionButton
            icon={<TypeIcon size={11} />}
            label="В заметки"
            onClick={() => batchUpdateRegions(pageId, regions.map((r) => r.id), { kind: 'note' })}
          />
          <BatchActionButton
            icon={<ScanTextIcon size={11} />}
            label="Очистить OCR"
            onClick={() =>
              batchUpdateRegions(pageId, regions.map((r) => r.id), {
                sourceText: '',
                ocrStatus: 'idle',
                ocrConfidence: undefined,
                ocrEngine: undefined,
              })
            }
            disabled={noneOcr}
          />
          <BatchActionButton
            icon={<MessageSquare size={11} />}
            label="Очистить перевод"
            onClick={() =>
              batchUpdateRegions(pageId, regions.map((r) => r.id), {
                translatedText: '',
                translationStatus: 'idle',
                translationProvider: undefined,
              })
            }
          />
          <BatchActionButton
            icon={<ListOrderedIcon size={11} />}
            label="Автонумерация (по позиции)"
            onClick={autoNumber}
          />
          <BatchActionButton
            icon={<Trash2Icon size={11} />}
            label="Удалить все"
            onClick={() => setConfirmDeleteAll(true)}
            destructive
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteAll}
        title="Удалить все регионы?"
        message={`Будут удалены все ${regions.length} регионов на этой странице. Действие нельзя отменить.`}
        confirmLabel="Удалить все"
        destructive
        onConfirm={() => {
          setConfirmDeleteAll(false);
          batchDelete();
        }}
        onCancel={() => { setConfirmDeleteAll(false); }}
      />
    </div>
  );
}

function BatchActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-all ${
        disabled
          ? 'cursor-not-allowed border-zinc-800/40 text-zinc-700'
          : destructive
            ? 'border-red-900/50 text-red-400 hover:border-red-700 hover:bg-red-500/10'
            : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
