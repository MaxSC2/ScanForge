import { useCallback, useState, type DragEvent } from 'react';
import { usePageStore } from '../stores/usePageStore';
import { useToastStore } from '../stores/useToastStore';

/**
 * Drag-and-drop file handling for the canvas area.
 */
export function useFileDrop() {
  const [isDragging, setIsDragging] = useState(false);
  const addPages = usePageStore((s) => s.addPages);
  const pushToast = useToastStore((s) => s.push);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || /\.cbz$/i.test(f.name) || /\.cbr$/i.test(f.name),
      );

      if (files.length === 0) {
        pushToast('Подходящие файлы не найдены', 'warning');
        return;
      }

      void addPages(files).then((count) => {
        pushToast(`Добавлено страниц: ${count}`, 'success');
      });
    },
    [addPages, pushToast],
  );

  return { isDragging, handleDragOver, handleDragLeave, handleDrop };
}
