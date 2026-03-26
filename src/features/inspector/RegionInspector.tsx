import { useState } from 'react';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { REGION_KIND_OPTIONS, getRegionColor } from '../../types';
import type { Region, RegionKind } from '../../types';
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  Type,
  Box,
  MessageSquare,
  Languages,
  StickyNote,
  Trash2,
  Copy,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Layers,
  Crosshair,
  GripVertical,
} from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

export function RegionInspector() {
  const selectedRegionId = useRegionStore((s) => s.selectedRegionId);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const deleteRegion = useRegionStore((s) => s.deleteRegion);
  const duplicateRegion = useRegionStore((s) => s.duplicateRegion);

  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });

  const region = activePage?.regions.find((r) => r.id === selectedRegionId);

  if (!activePage) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/60 flex items-center justify-center">
          <Settings2 size={20} className="text-zinc-600" />
        </div>
        <p className="text-xs text-zinc-500 font-medium">Страница не открыта</p>
      </div>
    );
  }

  if (!region) {
    return (
      <div className="flex flex-col h-full">
        <InspectorHeader count={activePage.regions.length} />

        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/60 flex items-center justify-center">
            <Crosshair size={20} className="text-zinc-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">Регион не выбран</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Кликни по региону на холсте или нарисуй новый
            </p>
          </div>
        </div>

        {/* Region list */}
        {activePage.regions.length > 0 && (
          <RegionListPanel
            regions={activePage.regions}
            selectedId={null}
            pageId={activePage.id}
          />
        )}
      </div>
    );
  }

  const pageId = activePage.id;
  const update = (patch: Partial<Region>) =>
    updateRegion(pageId, region.id, patch);

  return (
    <div className="flex flex-col h-full">
      <InspectorHeader count={activePage.regions.length} />

      <div className="flex-1 overflow-y-auto">
        {/* Quick actions bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800/60">
          <button
            onClick={() => update({ locked: !region.locked })}
            className={`p-1.5 rounded transition-colors ${region.locked ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
            title={region.locked ? 'Разблокировать' : 'Заблокировать'}
          >
            {region.locked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
          <button
            onClick={() => update({ visible: !region.visible })}
            className={`p-1.5 rounded transition-colors ${!region.visible ? 'text-zinc-600 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
            title={region.visible ? 'Скрыть' : 'Показать'}
          >
            {region.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            onClick={() => duplicateRegion(pageId, region.id)}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Дублировать"
          >
            <Copy size={13} />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => deleteRegion(pageId, region.id)}
            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Удалить регион"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Properties */}
        <AccordionSection title="Свойства" icon={<Type size={12} />} defaultOpen>
          <div className="flex flex-col gap-2.5">
            {/* Label */}
            <Field label="Название">
              <input
                type="text"
                value={region.label}
                onChange={(e) => update({ label: e.target.value })}
                className="input-field"
              />
            </Field>

            {/* Kind */}
            <Field label="Тип">
              <div className="flex gap-1">
                {REGION_KIND_OPTIONS.map((o) => {
                  const isActive = region.kind === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => update({ kind: o.value as RegionKind })}
                      className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all border ${
                        isActive
                          ? 'border-current'
                          : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                      }`}
                      style={isActive ? { color: o.color, borderColor: o.color, backgroundColor: `${o.color}15` } : {}}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Order */}
            <Field label="Порядок чтения">
              <input
                type="number"
                value={region.order}
                onChange={(e) => update({ order: Math.max(1, Number(e.target.value)) })}
                className="input-field w-20 text-center tabular-nums"
                min={1}
              />
            </Field>
          </div>
        </AccordionSection>

        {/* Geometry */}
        <AccordionSection title="Геометрия" icon={<Box size={12} />} defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="X" value={region.x} onChange={(v) => update({ x: v })} />
            <NumField label="Y" value={region.y} onChange={(v) => update({ y: v })} />
            <NumField label="Ширина" value={region.width} onChange={(v) => update({ width: v })} />
            <NumField label="Высота" value={region.height} onChange={(v) => update({ height: v })} />
          </div>
        </AccordionSection>

        {/* Source Text */}
        <AccordionSection title="Исходный текст" icon={<MessageSquare size={12} />} defaultOpen>
          <textarea
            rows={4}
            value={region.sourceText}
            onChange={(e) => update({ sourceText: e.target.value })}
            className="input-field resize-none"
            placeholder="Оригинальный текст (результат OCR)..."
          />
          {region.sourceText && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Символов: {region.sourceText.length}
            </p>
          )}
        </AccordionSection>

        {/* Translation */}
        <AccordionSection title="Перевод" icon={<Languages size={12} />} defaultOpen>
          <textarea
            rows={4}
            value={region.translatedText}
            onChange={(e) => update({ translatedText: e.target.value })}
            className="input-field resize-none"
            placeholder="Переведенный текст..."
          />
          {region.translatedText && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Символов: {region.translatedText.length}
            </p>
          )}
        </AccordionSection>

        {/* Notes */}
        <AccordionSection title="Заметки" icon={<StickyNote size={12} />}>
          <textarea
            rows={3}
            value={region.notes}
            onChange={(e) => update({ notes: e.target.value })}
            className="input-field resize-none"
            placeholder="Внутренние заметки..."
          />
        </AccordionSection>
      </div>

      {/* Region list */}
      <RegionListPanel
        regions={activePage.regions}
        selectedId={region.id}
        pageId={pageId}
      />
    </div>
  );
}

/* ─── Sub-components ─── */

function InspectorHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center px-3 py-2 border-b border-zinc-800">
      <Settings2 size={12} className="text-zinc-500 mr-1.5" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex-1">
          Инспектор
      </h2>
      <span className="text-[10px] text-zinc-600 tabular-nums">
          Регионов: {count}
      </span>
    </div>
  );
}

function AccordionSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-800/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon}
        <span className="flex-1 text-left">{title}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-zinc-500 font-medium">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        className="input-field text-center tabular-nums"
      />
    </label>
  );
}

function RegionListPanel({
  regions,
  selectedId,
  pageId,
}: {
  regions: Region[];
  selectedId: string | null;
  pageId: string;
}) {
  const selectRegion = useRegionStore((s) => s.selectRegion);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const reorderRegions = useRegionStore((s) => s.reorderRegions);

  if (regions.length === 0) return null;

  const orderedRegions = [...regions].sort((a, b) => a.order - b.order);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderRegions(pageId, result.source.index, result.destination.index);
  };

  return (
    <div className="border-t border-zinc-800 flex-none max-h-56">
      <div className="flex items-center px-3 py-1.5">
        <Layers size={10} className="text-zinc-600 mr-1.5" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex-1">
          Все регионы
        </span>
        <span className="text-[10px] text-zinc-600 tabular-nums">{regions.length}</span>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`region-list-${pageId}`}>
          {(dropProvided) => (
            <ul
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className="overflow-y-auto max-h-44 pb-1 px-1"
            >
              {orderedRegions.map((r, index) => {
                const isSelected = r.id === selectedId;
                const color = getRegionColor(r.kind);
                return (
                  <Draggable key={r.id} draggableId={r.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <li
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        onClick={() => selectRegion(r.id)}
                        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all duration-100 ${
                          snapshot.isDragging
                            ? 'bg-zinc-700 ring-1 ring-indigo-500/30'
                            : isSelected
                              ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20'
                              : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                        }`}
                      >
                        <span {...dragProvided.dragHandleProps}>
                          <GripVertical size={10} className="text-zinc-600 flex-none" />
                        </span>
                        <span
                          className="w-2 h-2 rounded-full flex-none"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate flex-1">{r.order}. {r.label}</span>
                        {r.locked && <Lock size={10} className="text-amber-500/60 flex-none" />}
                        {!r.visible && <EyeOff size={10} className="text-zinc-600 flex-none" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateRegion(pageId, r.id, { visible: !r.visible });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-zinc-300 transition-opacity flex-none"
                        >
                          {r.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                        </button>
                        <span className="text-[10px] text-zinc-600 tabular-nums flex-none">
                          {r.width}×{r.height}
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
