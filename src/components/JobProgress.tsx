import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { SquareIcon, XIcon } from '../icons';
import { useJobStore } from '../stores/useJobStore';
import type { JobRecord } from '../types';

export function JobProgress() {
  const jobs = useJobStore((state) => state.jobs);
  const cancelJob = useJobStore((state) => state.cancelJob);
  const [expanded, setExpanded] = useState(false);
  const hoverRef = useRef(false);

  const running = jobs.filter((j) => j.status === 'running');
  const queued = jobs.filter((j) => j.status === 'queued');
  const totalActive = running.length + queued.length;

  useEffect(() => {
    if (totalActive === 0) {
      setExpanded(false);
    }
  }, [totalActive]);

  if (totalActive === 0) return null;

  const currentJob = running[0];
  const currentProgress = currentJob ? (currentJob.progress ?? 0) : 0;
  const currentMessage = currentJob?.message ?? '';

  const stageLabel: Record<string, string> = {
    ocr: 'OCR',
    translate: 'Перевод',
    export: 'Экспорт',
  };

  const stageColor: Record<string, string> = {
    ocr: 'bg-indigo-500',
    translate: 'bg-emerald-500',
    export: 'bg-amber-500',
  };

  const stageTextColor: Record<string, string> = {
    ocr: 'text-indigo-400',
    translate: 'text-emerald-400',
    export: 'text-amber-400',
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mx-1 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-[11px] transition-colors hover:bg-zinc-800"
      >
        <LoaderCircle size={12} className="animate-spin text-indigo-400" />
        <span className="text-zinc-300">{totalActive}</span>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${Math.round(currentProgress * 100)}%` }}
          />
        </div>
        {currentMessage && (
          <span className="hidden max-w-40 truncate text-zinc-500 sm:inline">
            {currentMessage}
          </span>
        )}
      </button>

      {expanded && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-72 rounded-xl border border-zinc-800 bg-zinc-950/98 p-2 shadow-2xl shadow-black/40 backdrop-blur"
          onMouseEnter={() => { hoverRef.current = true; }}
          onMouseLeave={() => { hoverRef.current = false; }}
        >
          <div className="mb-1 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Задачи ({totalActive})
          </div>

          {running.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              stageLabel={stageLabel}
              stageColor={stageColor}
              stageTextColor={stageTextColor}
              onCancel={cancelJob}
            />
          ))}

          {queued.slice(0, 5).map((job) => (
            <JobRow
              key={job.id}
              job={job}
              stageLabel={stageLabel}
              stageColor={stageColor}
              stageTextColor={stageTextColor}
              onCancel={cancelJob}
            />
          ))}

          {queued.length > 5 && (
            <div className="px-2 py-1 text-[10px] text-zinc-600">
              + ещё {queued.length - 5} в очереди
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  stageLabel,
  stageColor,
  stageTextColor,
  onCancel,
}: {
  job: JobRecord;
  stageLabel: Record<string, string>;
  stageColor: Record<string, string>;
  stageTextColor: Record<string, string>;
  onCancel: (id: string) => void;
}) {
  const progress = job.status === 'queued' ? 0 : (job.progress ?? 0);
  const isRunning = job.status === 'running';

  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-900">
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium ${stageTextColor[job.stage] ?? 'text-zinc-400'}`}>
            {stageLabel[job.stage] ?? job.stage}
          </span>
          <span className="text-[10px] text-zinc-600">
            {job.status === 'queued' ? 'ожидает' : isRunning ? 'выполняется' : ''}
          </span>
          <span className="flex-1" />
          {isRunning && (
            <LoaderCircle size={10} className="animate-spin text-indigo-400" />
          )}
        </div>
        {job.message && (
          <div className="truncate text-[10px] text-zinc-500">{job.message}</div>
        )}
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isRunning ? stageColor[job.stage] ?? 'bg-indigo-500' : 'bg-zinc-600'
            }`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {(job.status === 'queued' || job.status === 'running') && (
        <button
          onClick={() => onCancel(job.id)}
          className="flex h-5 w-5 flex-none items-center justify-center rounded text-zinc-600 opacity-0 transition-all hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
          title="Отменить задачу"
        >
          <XIcon size={10} />
        </button>
      )}
    </div>
  );
}
