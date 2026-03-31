import {
  Box,
  Copy,
  Eye,
  EyeOff,
  Languages,
  Lock,
  MessageSquare,
  ScanText,
  StickyNote,
  Trash2,
  Unlock,
} from 'lucide-react';
import { REGION_KIND_OPTIONS, type Region, type RegionKind } from '../../types';
import {
  AccordionSection,
  Field,
  NumField,
  StatusPill,
} from './inspectorShared';

export function RegionDetailsPanel({
  pageId,
  region,
  update,
  onDuplicate,
  onDelete,
  onRerunOcr,
}: {
  pageId: string;
  region: Region;
  update: (patch: Partial<Region>) => void;
  onDuplicate: (pageId: string, regionId: string) => void;
  onDelete: (pageId: string, regionId: string) => void;
  onRerunOcr: () => void;
}) {
  return (
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
          onClick={() => onDuplicate(pageId, region.id)}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Дублировать"
        >
          <Copy size={13} />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => onDelete(pageId, region.id)}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Удалить регион"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccordionSection title="Свойства" icon={<span className="text-[12px]">T</span>} defaultOpen>
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
              onClick={onRerunOcr}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              title="Запустить OCR заново для этого региона"
            >
              <ScanText size={12} />
              <span>Re-run OCR</span>
            </button>
          </div>
          {region.sourceText ? (
            <p className="mt-1 text-[10px] text-zinc-600">Символов: {region.sourceText.length}</p>
          ) : null}
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
          {region.translatedText ? (
            <p className="mt-1 text-[10px] text-zinc-600">
              Символов: {region.translatedText.length}
            </p>
          ) : null}
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
  );
}
