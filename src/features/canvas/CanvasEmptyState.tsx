import type { DragEvent, RefObject } from 'react';
import { ImagePlus, Upload } from 'lucide-react';

export function CanvasEmptyState({
  containerRef,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  handleDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`flex h-full flex-col items-center justify-center gap-4 px-8 text-center transition-colors ${
          isDragging ? 'bg-indigo-500/5' : ''
        }`}
      >
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-2xl transition-all ${
            isDragging ? 'scale-110 bg-indigo-500/20' : 'bg-zinc-800/60'
          }`}
        >
          {isDragging ? (
            <Upload size={32} className="animate-bounce text-indigo-400" />
          ) : (
            <ImagePlus size={32} className="text-zinc-500" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-300">
            {isDragging ? 'Отпусти изображения здесь' : 'Страница не выбрана'}
          </p>
          <p className="mt-1.5 max-w-64 text-xs text-zinc-600">
            Загрузи изображения или PDF через тулбар или перетащи файлы сюда
          </p>
        </div>
        {!isDragging ? (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-600">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
              V
            </kbd>
            Выбор
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
              R
            </kbd>
            Рисование
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
              H
            </kbd>
            Панорама
          </div>
        ) : null}
      </div>
    </div>
  );
}
