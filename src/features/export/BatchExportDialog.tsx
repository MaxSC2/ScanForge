import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { XIcon } from '../../icons';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useToastStore } from '../../stores/useToastStore';
import { isDesktopRuntime } from '../../utils/runtime';
import { buildCbzBlob } from '../../utils/cbz';
import { renderPageToBlob } from './renderExport';

interface BatchExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = 'png' | 'cbz';

export function BatchExportDialog({ open, onClose }: BatchExportDialogProps) {
  const pages = usePageStore((state) => state.pages);
  const selectedPageIds = usePageStore((state) => state.selectedPageIds);
  const queueExportJobs = useJobStore((state) => state.queueExportJobs);
  const pushToast = useToastStore((state) => state.push);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('png');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      const initial =
        selectedPageIds.length > 0
          ? new Set(selectedPageIds)
          : new Set(pages.map((p) => p.id));
      setSelected(initial);
      setExporting(false);
    }
  }, [open, pages, selectedPageIds]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const totalPixels = useMemo(() => {
    let pixels = 0;
    for (const page of pages) {
      if (selected.has(page.id)) {
        pixels += page.naturalWidth * page.naturalHeight;
      }
    }
    return pixels;
  }, [pages, selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(pages.map((p) => p.id)));
  }, [pages]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedCount = selected.size;

  const handleExport = useCallback(async () => {
    const selectedPages = pages.filter((p) => selected.has(p.id));
    if (selectedPages.length === 0) {
      pushToast('Не выбрано ни одной страницы', 'warning');
      return;
    }

    setExporting(true);
    try {
      if (format === 'png') {
        const targets = selectedPages.map((page) => ({ pageId: page.id }));
        const queued = queueExportJobs(targets);
        if (queued === 0) {
          pushToast(
            'Экспорт уже стоит в очереди для выбранных страниц',
            'warning',
          );
        } else {
          pushToast(
            `Экспорт поставлен в очередь: ${queued} страниц(ы)`,
            'success',
          );
        }
        onClose();
      } else {
        const rendered: { fileName: string; data: ArrayBuffer }[] = [];
        for (let i = 0; i < selectedPages.length; i++) {
          const page = selectedPages[i];
          try {
            const { blob } = await renderPageToBlob(page);
            const data = await blob.arrayBuffer();
            const index = String(i + 1).padStart(3, '0');
            rendered.push({ fileName: `page-${index}.png`, data });
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : 'Неизвестная ошибка';
            pushToast(`Ошибка рендера ${page.fileName}: ${msg}`, 'error');
          }
        }

        if (rendered.length === 0) {
          pushToast('Не удалось отрендерить ни одной страницы', 'error');
          setExporting(false);
          return;
        }

        const cbzBlob = await buildCbzBlob(rendered);
        const suggestedName = `export.cbz`;

        if (isDesktopRuntime()) {
          const path = await save({
            title: 'Сохранить CBZ архив',
            defaultPath: suggestedName,
            filters: [
              { name: 'CBZ архив', extensions: ['cbz'] },
            ],
          });
          if (path) {
            const bytes = new Uint8Array(await cbzBlob.arrayBuffer());
            await writeFile(path, bytes);
            pushToast(
              `CBZ архив сохранён: ${rendered.length} страниц(ы)`,
              'success',
            );
          }
        } else {
          const url = URL.createObjectURL(cbzBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = suggestedName;
          a.click();
          URL.revokeObjectURL(url);
          pushToast(
            `CBZ архив скачан: ${rendered.length} страниц(ы)`,
            'success',
          );
        }
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      pushToast(`Ошибка экспорта: ${msg}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [pages, selected, format, queueExportJobs, pushToast, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
      <div className="flex w-[min(92vw,560px)] max-h-[88vh] flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Пакетный экспорт
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Формат:</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="input-field text-xs"
            >
              <option value="png">PNG (отдельные файлы)</option>
              <option value="cbz">CBZ (единый архив)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Выбрать все
            </button>
            <span className="text-zinc-700">|</span>
            <button
              onClick={deselectAll}
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Снять все
            </button>
          </div>

          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {pages.map((page) => (
              <label
                key={page.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${
                  selected.has(page.id)
                    ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30'
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(page.id)}
                  onChange={() => toggle(page.id)}
                  className="rounded border-zinc-700 bg-zinc-950 text-indigo-500"
                />
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                  <img
                    src={page.imageUrl}
                    alt={page.fileName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-zinc-300">
                    {page.fileName}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {page.naturalWidth} x {page.naturalHeight} px
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <p className="text-xs text-zinc-400">
              Выбрано:{' '}
              <span className="text-zinc-200">{selectedCount}</span> страниц
              {selectedCount > 0 ? (
                <span>
                  {' '}
                  | ~{(totalPixels * 3) / 1024 / 1024 < 0.1
                    ? '<0.1'
                    : (totalPixels * 3) / 1024 / 1024 < 10
                      ? (totalPixels * 3) / 1024 / 1024
                      : Math.round((totalPixels * 3) / 1024 / 1024)}
                  MB (raw) <span className="text-zinc-600">/ меньше в PNG</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            onClick={onClose}
            disabled={exporting}
            className="h-8 rounded bg-zinc-800 px-3 text-xs text-zinc-300 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleExport}
            disabled={selectedCount === 0 || exporting}
            className="h-8 rounded bg-indigo-600 px-3 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? 'Экспорт...' : 'Экспортировать'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
