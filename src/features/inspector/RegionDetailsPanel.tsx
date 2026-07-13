import { useState } from 'react';
import {
  Copy,
  MessageSquare,
  Sparkles,
  StickyNote,
  Unlock,
} from 'lucide-react';
import {
  BoxIcon,
  EyeIcon,
  EyeOffIcon,
  LanguagesIcon,
  LockIcon,
  ScanTextIcon,
  Trash2Icon,
} from '../../icons';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { REGION_KIND_OPTIONS, type Region, type RegionKind, type RegionOrientation } from '../../types';
import {
  AccordionSection,
  Field,
  NumField,
  StatusPill,
} from './inspectorShared';

const SOURCE_LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: 'Авто' },
  { value: 'ja', label: 'Японский' },
  { value: 'zh', label: 'Китайский' },
  { value: 'ko', label: 'Корейский' },
  { value: 'en', label: 'Английский' },
  { value: 'ru', label: 'Русский' },
];

const TARGET_LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'Английский' },
  { value: 'ja', label: 'Японский' },
  { value: 'zh', label: 'Китайский' },
  { value: 'ko', label: 'Корейский' },
];

export function RegionDetailsPanel({
  pageId,
  region,
  update,
  onDuplicate,
  onSplit,
  onDelete,
  onRerunOcr,
}: {
  pageId: string;
  region: Region;
  update: (patch: Partial<Region>) => void;
  onDuplicate: (pageId: string, regionId: string) => void;
  onSplit: (pageId: string, regionId: string) => void;
  onDelete: (pageId: string, regionId: string) => void;
  onRerunOcr: () => void;
}) {
  const queueTranslate = useJobStore((s) => s.queueTranslationJobs);
  const reorderRegions = useRegionStore((s) => s.reorderRegions);
  const textStyles = useProjectDomainStore((s) => s.textStyles);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHiddenFields, setShowHiddenFields] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800/60 px-3 py-2">
        <button
          onClick={() => update({ locked: !region.locked })}
          aria-label={region.locked ? 'Разблокировать' : 'Заблокировать'}
          className={`rounded p-1.5 transition-colors ${
            region.locked
              ? 'bg-amber-500/10 text-amber-400'
              : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
          }`}
          title={region.locked ? 'Разблокировать' : 'Заблокировать'}
        >
          {region.locked ? <LockIcon size={13} /> : <Unlock size={13} />}
        </button>

        <button
          onClick={() => update({ visible: !region.visible })}
          aria-label={region.visible ? 'Скрыть' : 'Показать'}
          className={`rounded p-1.5 transition-colors ${
            !region.visible
              ? 'bg-zinc-800 text-zinc-500'
              : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
          }`}
          title={region.visible ? 'Скрыть' : 'Показать'}
        >
          {region.visible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
        </button>

        {region.sourceText && (
          <button
            onClick={() => navigator.clipboard?.writeText(region.sourceText)}
            aria-label="Копировать исходный текст"
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title="Копировать исходный текст"
          >
            <Copy size={13} />
          </button>
        )}

        <button
          onClick={() => {
            const page = usePageStore.getState().getActivePage();
            if (!page) return;
            const sorted = [...page.regions].sort(
              (a, b) => a.order - b.order,
            );
            const idx = sorted.findIndex((r) => r.id === region.id);
            if (idx > 0) reorderRegions(pageId, idx, 0);
          }}
          aria-label="На задний план"
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="На задний план"
        >
          <span className="text-[11px] font-bold">↓</span>
        </button>

        <button
          onClick={() => {
            const page = usePageStore.getState().getActivePage();
            if (!page) return;
            const sorted = [...page.regions].sort(
              (a, b) => a.order - b.order,
            );
            const idx = sorted.findIndex((r) => r.id === region.id);
            if (idx < sorted.length - 1) reorderRegions(pageId, idx, sorted.length - 1);
          }}
          aria-label="На передний план"
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="На передний план"
        >
          <span className="text-[11px] font-bold">↑</span>
        </button>

        <button
          onClick={() => update({ groupId: region.groupId ? undefined : (crypto.randomUUID?.() ?? `${Date.now()}`) })}
          aria-label={region.groupId ? 'Разгруппировать' : 'Сгруппировать'}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title={region.groupId ? 'Разгруппировать' : 'Сгруппировать'}
        >
          <span className="text-[11px] font-bold">{region.groupId ? '∄' : '⊕'}</span>
        </button>

        <button
          onClick={() => onDuplicate(pageId, region.id)}
          aria-label="Дублировать"
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Дублировать"
        >
          <Copy size={13} />
        </button>

        <button
          onClick={() => onSplit(pageId, region.id)}
          aria-label="Разделить"
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Разделить"
        >
          <span className="text-[11px] font-bold">↔</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Удалить регион"
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Удалить регион"
        >
          <Trash2Icon size={13} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Удалить «${region.label}»?`}
        message="Регион и его данные будут безвозвратно удалены."
        confirmLabel="Удалить"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(pageId, region.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />

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

            <button
              onClick={() => setShowHiddenFields((v) => !v)}
              className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showHiddenFields ? 'Скрыть доп. поля' : 'Дополнительные поля ▸'}
            </button>

            {showHiddenFields && (
              <>
                <Field label="Ориентация">
                  <select
                    value={region.orientation}
                    onChange={(e) => update({ orientation: e.target.value as RegionOrientation })}
                    className="input-field"
                  >
                    <option value="horizontal">Горизонтальная</option>
                    <option value="vertical">Вертикальная</option>
                  </select>
                </Field>

                <Field label="Стиль текста">
                  <select
                    value={region.textStyleId ?? ''}
                    onChange={(e) => update({ textStyleId: e.target.value || undefined })}
                    className="input-field"
                  >
                    <option value="">— По умолчанию —</option>
                    {textStyles.map((ts) => (
                      <option key={ts.id} value={ts.id}>{ts.name}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>
        </AccordionSection>

        <AccordionSection title="Геометрия" icon={<BoxIcon size={12} />} defaultOpen>
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
            {showHiddenFields && (
              <NumField
                label="Поворот"
                value={region.rotation}
                onChange={(value) => update({ rotation: value })}
              />
            )}
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
              <span
                className={`rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] ${
                  region.ocrConfidence >= 0.8
                    ? 'text-emerald-400'
                    : region.ocrConfidence >= 0.5
                      ? 'text-amber-400'
                      : 'text-red-400'
                }`}
              >
                {Math.round(region.ocrConfidence * 100)}%
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!region.ocrOverwriteEnabled}
                  onChange={(event) => update({ ocrOverwriteEnabled: event.target.checked })}
                  className="h-3 w-3 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0"
                />
                Перезаписывать при OCR
              </label>
              {showHiddenFields && region.targetLanguage && (
                <span className="text-[10px] text-zinc-600 ml-auto">
                  Цель: {TARGET_LANGUAGE_OPTIONS.find((l) => l.value === region.targetLanguage)?.label ?? region.targetLanguage}
                </span>
              )}
            </div>
            <button
              onClick={onRerunOcr}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              title="Запустить OCR заново для этого региона"
            >
              <ScanTextIcon size={12} />
              <span>Re-run OCR</span>
            </button>
          </div>
          {region.sourceText ? (
            <p className="mt-1 text-[10px] text-zinc-600">Символов: {region.sourceText.length}</p>
          ) : null}
          {showHiddenFields && (
            <div className="mt-2">
              <Field label="Язык оригинала">
                <select
                  value={region.sourceLanguage ?? ''}
                  onChange={(e) => update({ sourceLanguage: e.target.value || undefined })}
                  className="input-field"
                >
                  <option value="">— По умолчанию —</option>
                  {SOURCE_LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </AccordionSection>

        <AccordionSection title="Перевод" icon={<LanguagesIcon size={12} />} defaultOpen>
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
          {showHiddenFields && (
            <div className="mt-2">
              <Field label="Язык перевода">
                <select
                  value={region.targetLanguage ?? ''}
                  onChange={(e) => update({ targetLanguage: e.target.value || undefined })}
                  className="input-field"
                >
                  <option value="">— По умолчанию —</option>
                  {TARGET_LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1">
            {region.sourceText && (
              <button
                onClick={() => queueTranslate([{ pageId, regionIds: [region.id] }])}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:border-indigo-700 hover:bg-indigo-900/20 hover:text-indigo-300"
                title="Перевести AI"
              >
                <Sparkles size={10} />
                <span>Перевести</span>
              </button>
            )}
            {region.translatedText && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(region.translatedText);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                title="Копировать перевод"
              >
                <Copy size={10} />
                <span>Копировать</span>
              </button>
            )}
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
