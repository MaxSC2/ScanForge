import { useEffect, useState, type ReactNode } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  GripVertical,
  Languages,
  Layers,
  Lock,
  MessageSquare,
  ScanText,
  Settings2,
  StickyNote,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import { ProjectSettingsPanel } from '../settings/ProjectSettingsPanel';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useToastStore } from '../../stores/useToastStore';
import { REGION_KIND_OPTIONS, getRegionColor } from '../../types';
import type { Region, RegionKind } from '../../types';

type InspectorView = 'details' | 'regions' | 'pipeline';

export function RegionInspector() {
  const [activeView, setActiveView] = useState<InspectorView>('details');

  const selectedRegionId = useRegionStore((state) => state.selectedRegionId);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const deleteRegion = useRegionStore((state) => state.deleteRegion);
  const duplicateRegion = useRegionStore((state) => state.duplicateRegion);
  const queueOcrJobs = useJobStore((state) => state.queueOcrJobs);
  const pushToast = useToastStore((state) => state.push);

  const activePage = usePageStore((state) => {
    const id = state.activePageId;
    return id ? state.pages.find((page) => page.id === id) : undefined;
  });

  const region = activePage?.regions.find((item) => item.id === selectedRegionId);

  useEffect(() => {
    if (selectedRegionId) {
      setActiveView('details');
    }
  }, [selectedRegionId]);

  if (!activePage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
          <Settings2 size={20} className="text-zinc-600" />
        </div>
        <p className="text-xs font-medium text-zinc-500">Страница не открыта</p>
      </div>
    );
  }

  const pageId = activePage.id;
  const update = (patch: Partial<Region>) => {
    if (!region) return;
    updateRegion(pageId, region.id, patch);
  };

  const rerunOcr = () => {
    if (!region) return;

    const queued = queueOcrJobs([{ pageId, regionIds: [region.id] }]);
    if (queued === 0) {
      pushToast('OCR already queued for this region', 'info');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <InspectorHeader
        count={activePage.regions.length}
        activeView={activeView}
        onChange={setActiveView}
      />

      {activeView === 'pipeline' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProjectSettingsPanel />
        </div>
      ) : activeView === 'regions' ? (
        activePage.regions.length > 0 ? (
          <RegionListPanel
            regions={activePage.regions}
            selectedId={region?.id ?? null}
            pageId={pageId}
            fullHeight
          />
        ) : (
          <InspectorEmptyState
            icon={<Layers size={20} className="text-zinc-600" />}
            title="Регионов пока нет"
            description="Нарисуй регион на холсте, и он появится в списке."
          />
        )
      ) : region ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-zinc-800/60 px-3 py-2">
            <button
              onClick={() => update({ locked: !region.locked })}
              className={`rounded p-1.5 transition-colors ${
                region.locked
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
              title={region.locked ? 'Разблокировать' : 'Заблокировать'}
            >
              {region.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>

            <button
              onClick={() => update({ visible: !region.visible })}
              className={`rounded p-1.5 transition-colors ${
                !region.visible
                  ? 'bg-zinc-800 text-zinc-500'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
              title={region.visible ? 'Скрыть' : 'Показать'}
            >
              {region.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>

            <button
              onClick={() => duplicateRegion(pageId, region.id)}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              title="Дублировать"
            >
              <Copy size={13} />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => deleteRegion(pageId, region.id)}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Удалить регион"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <AccordionSection title="Свойства" icon={<Type size={12} />} defaultOpen>
              <div className="flex flex-col gap-2.5">
                <Field label="Название">
                  <input
                    type="text"
                    value={region.label}
                    onChange={(event) => update({ label: event.target.value })}
                    className="input-field"
                  />
                </Field>

                <Field label="Тип">
                  <div className="flex gap-1">
                    {REGION_KIND_OPTIONS.map((option) => {
                      const isActive = region.kind === option.value;

                      return (
                        <button
                          key={option.value}
                          onClick={() => update({ kind: option.value as RegionKind })}
                          className={`flex-1 rounded border px-2 py-1.5 text-[10px] font-medium transition-all ${
                            isActive
                              ? 'border-current'
                              : 'border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                          }`}
                          style={
                            isActive
                              ? {
                                  color: option.color,
                                  borderColor: option.color,
                                  backgroundColor: `${option.color}15`,
                                }
                              : {}
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Порядок чтения">
                  <input
                    type="number"
                    value={region.order}
                    onChange={(event) => update({ order: Math.max(1, Number(event.target.value)) })}
                    className="input-field w-20 text-center tabular-nums"
                    min={1}
                  />
                </Field>
              </div>
            </AccordionSection>

            <AccordionSection title="Геометрия" icon={<Box size={12} />} defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="X" value={region.x} onChange={(value) => update({ x: value })} />
                <NumField label="Y" value={region.y} onChange={(value) => update({ y: value })} />
                <NumField
                  label="Ширина"
                  value={region.width}
                  onChange={(value) => update({ width: value })}
                />
                <NumField
                  label="Высота"
                  value={region.height}
                  onChange={(value) => update({ height: value })}
                />
              </div>
            </AccordionSection>

            <AccordionSection title="Исходный текст" icon={<MessageSquare size={12} />} defaultOpen>
              <textarea
                rows={4}
                value={region.sourceText}
                onChange={(event) => update({ sourceText: event.target.value })}
                className="input-field resize-none"
                placeholder="Оригинальный текст или результат OCR..."
              />
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-zinc-500">
                <StatusPill label={`OCR ${region.ocrStatus}`} />
                {region.ocrEngine ? <StatusPill label={region.ocrEngine} /> : null}
                {typeof region.ocrConfidence === 'number' ? (
                  <StatusPill label={`conf ${Math.round(region.ocrConfidence * 100)}%`} />
                ) : null}
              </div>
              <div className="mt-2 flex">
                <button
                  onClick={rerunOcr}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  title="Run OCR again for this region"
                >
                  <ScanText size={12} />
                  <span>Re-run OCR</span>
                </button>
              </div>
              {region.sourceText && (
                <p className="mt-1 text-[10px] text-zinc-600">Символов: {region.sourceText.length}</p>
              )}
            </AccordionSection>

            <AccordionSection title="Перевод" icon={<Languages size={12} />} defaultOpen>
              <textarea
                rows={4}
                value={region.translatedText}
                onChange={(event) => update({ translatedText: event.target.value })}
                className="input-field resize-none"
                placeholder="Переведенный текст..."
              />
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-zinc-500">
                <StatusPill label={`TR ${region.translationStatus}`} />
                {region.translationProvider ? (
                  <StatusPill label={region.translationProvider} />
                ) : null}
                {region.targetLanguage ? <StatusPill label={region.targetLanguage} /> : null}
              </div>
              {region.translatedText && (
                <p className="mt-1 text-[10px] text-zinc-600">
                  Символов: {region.translatedText.length}
                </p>
              )}
            </AccordionSection>

            <AccordionSection title="Заметки" icon={<StickyNote size={12} />}>
              <textarea
                rows={3}
                value={region.notes}
                onChange={(event) => update({ notes: event.target.value })}
                className="input-field resize-none"
                placeholder="Внутренние заметки..."
              />
            </AccordionSection>
          </div>
        </div>
      ) : (
        <InspectorEmptyState
          icon={<Crosshair size={20} className="text-zinc-600" />}
          title="Регион не выбран"
          description="Кликни по региону на холсте или открой список регионов."
          action={
            activePage.regions.length > 0 ? (
              <button
                onClick={() => setActiveView('regions')}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                Открыть список регионов
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}

function InspectorHeader({
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
          icon={<Type size={12} />}
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

function InspectorEmptyState({
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

function AccordionSection({
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
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-400">
      {label}
    </span>
  );
}

function RegionListPanel({
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

                        {region.locked && <Lock size={10} className="flex-none text-amber-500/60" />}
                        {!region.visible && <EyeOff size={10} className="flex-none text-zinc-600" />}

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
                          {region.width}×{region.height}
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
