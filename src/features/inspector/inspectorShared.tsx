import { useState, type ReactNode } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Lock,
  Settings2,
} from 'lucide-react';
import { getRegionColor, type Region } from '../../types';
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
        <Settings2 size={12} className="text-zinc-500" />
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
          icon={<Layers size={12} />}
          label="Регионы"
          onClick={() => onChange('regions')}
        />
        <InspectorTabButton
          active={activeView === 'pipeline'}
          icon={<Settings2 size={12} />}
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
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
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
  const selectRegion = useRegionStore((state) => state.selectRegion);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const reorderRegions = useRegionStore((state) => state.reorderRegions);

  if (regions.length === 0) return null;

  const orderedRegions = [...regions].sort((first, second) => first.order - second.order);

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
      <div className="flex items-center px-3 py-2">
        <Layers size={10} className="mr-1.5 text-zinc-600" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Все регионы
        </span>
        <span className="text-[10px] tabular-nums text-zinc-600">{regions.length}</span>
      </div>

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
                        onClick={() => selectRegion(region.id)}
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

                        {region.locked ? <Lock size={10} className="flex-none text-amber-500/60" /> : null}
                        {!region.visible ? <EyeOff size={10} className="flex-none text-zinc-600" /> : null}

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            updateRegion(pageId, region.id, { visible: !region.visible });
                          }}
                          className="flex-none p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                        >
                          {region.visible ? <Eye size={10} /> : <EyeOff size={10} />}
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
    </div>
  );
}
