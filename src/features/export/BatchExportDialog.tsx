import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { LoaderCircle } from 'lucide-react';
import { XIcon } from '../../icons';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useToastStore } from '../../stores/useToastStore';
import { isDesktopRuntime } from '../../utils/runtime';
import { buildCbzBlob } from '../../utils/cbz';
import { encodeTiff } from '../../utils/tiff';
import { renderPageToBlob } from './renderExport';

interface BatchExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = 'png' | 'cbz' | 'pdf' | 'tiff';

interface ExportProgress {
  pageId: string;
  fileName: string;
  status: 'pending' | 'rendering' | 'done' | 'failed';
  error?: string;
}

export function BatchExportDialog({ open, onClose }: BatchExportDialogProps) {
  const pages = usePageStore((state) => state.pages);
  const selectedPageIds = usePageStore((state) => state.selectedPageIds);
  const queueExportJobs = useJobStore((state) => state.queueExportJobs);
  const pushToast = useToastStore((state) => state.push);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('png');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress[]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    if (open) {
      const initial =
        selectedPageIds.length > 0
          ? new Set(selectedPageIds)
          : new Set(pages.map((p) => p.id));
      setSelected(initial);
      setExporting(false);
      setProgress([]);
      abortRef.current = false;
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
    abortRef.current = false;

    if (format === 'png') {
      const targets = selectedPages.map((page) => ({ pageId: page.id }));
      const queued = queueExportJobs(targets);
      if (queued === 0) {
        pushToast('Экспорт уже стоит в очереди для выбранных страниц', 'warning');
      } else {
        pushToast(`Экспорт поставлен в очередь: ${queued} страниц(ы)`, 'success');
      }
      onClose();
      return;
    }

    setProgress(
      selectedPages.map((p) => ({
        pageId: p.id,
        fileName: p.fileName,
        status: 'pending' as const,
      })),
    );

    try {
      const rendered: { fileName: string; data: ArrayBuffer; width: number; height: number }[] = [];
      for (let i = 0; i < selectedPages.length; i++) {
        if (abortRef.current) break;
        const page = selectedPages[i];
        setProgress((prev) =>
          prev.map((p) =>
            p.pageId === page.id ? { ...p, status: 'rendering' as const } : p,
          ),
        );
        try {
          const { blob } = await renderPageToBlob(page);
          const data = await blob.arrayBuffer();
          const index = String(i + 1).padStart(3, '0');
          rendered.push({ fileName: `page-${index}.png`, data, width: page.naturalWidth, height: page.naturalHeight });
          setProgress((prev) =>
            prev.map((p) =>
              p.pageId === page.id ? { ...p, status: 'done' as const } : p,
            ),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
          setProgress((prev) =>
            prev.map((p) =>
              p.pageId === page.id
                ? { ...p, status: 'failed' as const, error: msg }
                : p,
            ),
          );
          pushToast(`Ошибка рендера ${page.fileName}: ${msg}`, 'error');
        }
      }

      if (rendered.length === 0) {
        pushToast('Не удалось отрендерить ни одной страницы', 'error');
        setExporting(false);
        return;
      }

      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf');
        // Use A4 landscape as default with custom page size per image
        let pdf: import('jspdf').jsPDF | null = null;
        let first = true;
        for (const { data, width, height } of rendered) {
          const blob = new Blob([data], { type: 'image/png' });
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const dpi = 72;
          const wMm = (width / dpi) * 25.4;
          const hMm = (height / dpi) * 25.4;
          if (first) {
            pdf = new jsPDF({ unit: 'mm', format: [wMm, hMm] });
            first = false;
          } else {
            pdf!.addPage([wMm, hMm]);
          }
          pdf!.addImage(dataUrl, 'PNG', 0, 0, wMm, hMm);
        }
        if (pdf) {
          pdf.save(`export_${Date.now()}.pdf`);
          pushToast(`PDF сохранён: ${rendered.length} страниц(ы)`, 'success');
        }
        setExporting(false);
        return;
      }

      if (format === 'tiff') {
        // Export pages as individual TIFF files
        for (const { data, width, height } of rendered) {
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d')!;
          const img = new Image(width, height);
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.src = URL.createObjectURL(new Blob([data], { type: 'image/png' }));
          });
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, width, height);
          const tiffBytes = encodeTiff(imageData);
          const blob = new Blob([tiffBytes], { type: 'image/tiff' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `page-${Date.now()}.tiff`;
          a.click();
          URL.revokeObjectURL(url);
        }
        pushToast(`TIFF экспорт: ${rendered.length} страниц(ы)`, 'success');
        setExporting(false);
        return;
      }

      const cbzBlob = await buildCbzBlob(rendered);
      const suggestedName = `export.cbz`;

      if (isDesktopRuntime()) {
        const path = await save({
          title: 'Сохранить CBZ архив',
          defaultPath: suggestedName,
          filters: [{ name: 'CBZ архив', extensions: ['cbz'] }],
        });
        if (path) {
          const bytes = new Uint8Array(await cbzBlob.arrayBuffer());
          await writeFile(path, bytes);
          pushToast(`CBZ архив сохранён: ${rendered.length} страниц(ы)`, 'success');
        }
      } else {
        const url = URL.createObjectURL(cbzBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        a.click();
        URL.revokeObjectURL(url);
        pushToast(`CBZ архив скачан: ${rendered.length} страниц(ы)`, 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      pushToast(`Ошибка экспорта: ${msg}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [pages, selected, format, queueExportJobs, pushToast, onClose]);

  const doneCount = progress.filter((p) => p.status === 'done').length;
  const failedCount = progress.filter((p) => p.status === 'failed').length;
  const totalCount = progress.length;

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
              <option value="pdf">PDF (единый документ)</option>
              <option value="tiff">TIFF (постранично)</option>
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

        {exporting && progress.length > 0 && (
          <div className="space-y-1 px-4 py-2">
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <LoaderCircle size={11} className="animate-spin text-indigo-400" />
              <span className="flex-1">Рендер страниц</span>
              <span>{doneCount + failedCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(totalCount > 0 ? (doneCount + failedCount) / totalCount : 0) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {progress.map((p) => (
                <span
                  key={p.pageId}
                  className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] ${
                    p.status === 'done'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : p.status === 'failed'
                        ? 'bg-red-500/10 text-red-400'
                        : p.status === 'rendering'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-zinc-800 text-zinc-600'
                  }`}
                  title={p.error}
                >
                  {p.status === 'rendering' && <LoaderCircle size={7} className="animate-spin" />}
                  {p.fileName}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            onClick={() => {
              if (exporting) {
                abortRef.current = true;
              }
              onClose();
            }}
            className="h-8 rounded bg-zinc-800 px-3 text-xs text-zinc-300 disabled:opacity-50"
          >
            {exporting ? 'Прервать' : 'Отмена'}
          </button>
          <button
            onClick={handleExport}
            disabled={selectedCount === 0 || exporting}
            className="h-8 rounded bg-indigo-600 px-3 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? `Рендер... ${doneCount + failedCount}/${totalCount}` : 'Экспортировать'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
