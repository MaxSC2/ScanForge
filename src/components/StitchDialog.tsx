import type {
  StitchAlign,
  StitchDirection,
  StitchOptions,
  StitchScaleMode,
} from '../types';
import type { SafeStitchSuggestion, StitchPreviewResult } from '../utils/stitch';
import { createPortal } from 'react-dom';

interface StitchDialogProps {
  open: boolean;
  value: StitchOptions;
  preview: StitchPreviewResult | null;
  safeSuggestion: SafeStitchSuggestion | null;
  onChange: (patch: Partial<StitchOptions>) => void;
  onAutoFix: () => void;
  onAutoFixAndSubmit: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function StitchDialog({
  open,
  value,
  preview,
  safeSuggestion,
  onChange,
  onAutoFix,
  onAutoFixAndSubmit,
  onClose,
  onSubmit,
}: StitchDialogProps) {
  if (!open) return null;

  const hasRisk = !!preview && (preview.safety.maxAreaExceeded || preview.safety.maxDimensionExceeded);
  const alignStartLabel = value.direction === 'vertical' ? 'По левому краю' : 'По верхнему краю';
  const alignEndLabel = value.direction === 'vertical' ? 'По правому краю' : 'По нижнему краю';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
      <div className="w-[min(92vw,620px)] max-h-[88vh] border border-zinc-800 bg-zinc-900 rounded-lg shadow-2xl shadow-black/60 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Параметры склейки</h3>
        </div>

        <div className="p-4 text-xs overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Направление</span>
            <select
              value={value.direction}
              onChange={(e) => onChange({ direction: e.target.value as StitchDirection })}
              className="input-field"
            >
              <option value="vertical">Вертикально</option>
              <option value="horizontal">Горизонтально</option>
            </select>
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Выравнивание</span>
            <select
              value={value.align}
              onChange={(e) => onChange({ align: e.target.value as StitchAlign })}
              className="input-field"
            >
              <option value="start">{alignStartLabel}</option>
              <option value="center">По центру</option>
              <option value="end">{alignEndLabel}</option>
            </select>
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-zinc-500">Нормализация размера</span>
            <select
              value={value.scaleMode}
              onChange={(e) => onChange({ scaleMode: e.target.value as StitchScaleMode })}
              className="input-field"
            >
              <option value="normalize-cross-axis">
                Нормализовать поперечную ось (рекомендуется)
              </option>
              <option value="original">Сохранить исходные размеры</option>
            </select>
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-zinc-500">
              Размер поперечной оси, px (необязательно, auto = максимум из исходников)
            </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={value.crossAxisSize ?? ''}
                  disabled={value.scaleMode === 'original'}
                  onChange={(e) => {
                    const next = e.target.value.trim();
                    onChange({ crossAxisSize: next ? Math.max(1, Number(next) || 1) : null });
                  }}
                  className="input-field"
                  placeholder="Авто"
                />
                {hasRisk && safeSuggestion ? (
                  <button
                    onClick={onAutoFix}
                    className="h-9 shrink-0 px-2 rounded bg-amber-700 text-white text-[11px]"
                    title="Подобрать безопасный размер"
                  >
                    Автофикс
                  </button>
                ) : null}
              </div>
            </label>

            <label className="flex items-center gap-2 text-zinc-400">
            <input
              type="checkbox"
              checked={value.allowUpscale}
              disabled={value.scaleMode === 'original'}
              onChange={(e) => onChange({ allowUpscale: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-950"
            />
            Разрешить увеличение маленьких изображений до размера нормализации
            </label>

            <label className="flex items-center gap-2 text-zinc-400">
            <input
              type="checkbox"
              checked={value.exportAfterStitch}
              onChange={(e) => onChange({ exportAfterStitch: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-950"
            />
            Сразу экспортировать склеенную страницу
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Отступ между страницами (px)</span>
            <input
              type="number"
              min={0}
              value={value.gap}
              onChange={(e) => onChange({ gap: Math.max(0, Number(e.target.value) || 0) })}
              className="input-field"
            />
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Фон</span>
            <input
              type="color"
              value={value.background}
              onChange={(e) => onChange({ background: e.target.value })}
              className="h-9 w-full rounded border border-zinc-700 bg-zinc-950"
            />
            </label>

            <div className="md:col-span-2 rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <p className="text-zinc-500">Предпросмотр результата</p>
              {preview ? (
                <div className="mt-1 space-y-1 text-zinc-300">
                  <p>
                    {preview.width.toLocaleString()} x {preview.height.toLocaleString()} px
                  </p>
                  <p className="text-zinc-400">
                    Пиксели: {preview.pixelCount.toLocaleString()} (~{preview.estimatedPngMiB.low}-
                    {preview.estimatedPngMiB.high} MiB PNG)
                  </p>
                  <p className="text-zinc-400">
                    Страниц: {preview.pageCount} | Масштаб:{' '}
                    {Math.round(preview.minScale * 100)}-
                    {Math.round(preview.maxScale * 100)}%
                  </p>
                  {preview.targetCrossAxis ? (
                    <p className="text-zinc-400">
                      Нормализованная поперечная ось: {preview.targetCrossAxis.toLocaleString()} px
                    </p>
                  ) : null}
                  {preview.safety.maxDimensionExceeded || preview.safety.maxAreaExceeded ? (
                    <div className="mt-1 rounded border border-amber-700/40 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-300">
                      Есть риск превышения лимитов canvas.
                      {preview.safety.maxDimensionExceeded ? (
                        <p>Одна из сторон слишком большая для многих браузеров и GPU.</p>
                      ) : null}
                      {preview.safety.maxAreaExceeded ? (
                        <p>Общая площадь в пикселях слишком велика, экспорт может завершиться ошибкой.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-zinc-400">Выбери минимум 2 страницы для предпросмотра.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
          {hasRisk && safeSuggestion ? (
            <>
              <button
                onClick={onAutoFixAndSubmit}
                className="h-8 px-3 rounded bg-amber-600 text-white text-xs"
              >
                Автофикс + Склеить
              </button>
            </>
          ) : null}
          <button onClick={onClose} className="h-8 px-3 rounded bg-zinc-800 text-zinc-300 text-xs">
            Отмена
          </button>
          <button
            onClick={onSubmit}
            disabled={hasRisk}
            title={hasRisk ? 'Используй автофикс или уменьши размер, чтобы продолжить' : 'Склеить'}
            className="h-8 px-3 rounded bg-indigo-600 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Склеить
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
