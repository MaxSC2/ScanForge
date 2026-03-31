import {
  CircleAlert,
  CircleCheckBig,
  Download,
  Eraser,
  Languages,
  LoaderCircle,
  RotateCcw,
  ScanText,
} from 'lucide-react';
import type { JobRecord } from '../../types';
import {
  formatClock,
  formatReason,
  formatStatus,
  formatTarget,
} from './jobsPanelFormatting';

export function JobQueueSection({
  jobs,
  processing,
  runningCount,
  queuedCount,
  failedCount,
  retryJob,
  clearFinished,
}: {
  jobs: JobRecord[];
  processing: boolean;
  runningCount: number;
  queuedCount: number;
  failedCount: number;
  retryJob: (jobId: string) => void;
  clearFinished: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <SummaryCard label="В работе" value={runningCount} />
        <SummaryCard label="В очереди" value={queuedCount} />
        <SummaryCard label="Ошибки" value={failedCount} />
      </div>

      <div className="flex items-center gap-1">
        <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-500">
          {processing ? (
            <LoaderCircle size={11} className="animate-spin text-indigo-400" />
          ) : (
            <ScanText size={11} className="text-zinc-500" />
          )}
          {processing ? 'Пайплайн активен' : 'Пайплайн ожидает'}
        </div>

        <button
          onClick={clearFinished}
          className="ml-auto inline-flex h-7 items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          title="Очистить завершенные и ошибочные задачи"
        >
          <Eraser size={11} />
          Очистить
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
        {jobs.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] font-medium text-zinc-400">Очередь задач пуста</p>
            <p className="mt-1 text-[10px] text-zinc-600">
              Запусти OCR, перевод или экспорт через верхнюю панель.
            </p>
          </div>
        ) : (
          <ul className="max-h-56 overflow-y-auto p-1">
            {jobs.map((job) => (
              <JobListItem key={job.id} job={job} retryJob={retryJob} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
      <div className="text-zinc-600">{label}</div>
      <div className="mt-1 text-xs font-semibold text-zinc-200">{value}</div>
    </div>
  );
}

function JobListItem({
  job,
  retryJob,
}: {
  job: JobRecord;
  retryJob: (jobId: string) => void;
}) {
  const stageLabel =
    job.stage === 'ocr' ? 'OCR' : job.stage === 'translate' ? 'Перевод' : 'Экспорт';
  const statusIcon =
    job.status === 'running' ? (
      <LoaderCircle size={12} className="animate-spin text-indigo-400" />
    ) : job.status === 'done' ? (
      <CircleCheckBig size={12} className="text-emerald-400" />
    ) : job.status === 'failed' ? (
      <CircleAlert size={12} className="text-amber-400" />
    ) : job.stage === 'export' ? (
      <Download size={12} className="text-zinc-500" />
    ) : job.stage === 'translate' ? (
      <Languages size={12} className="text-zinc-500" />
    ) : (
      <ScanText size={12} className="text-zinc-500" />
    );

  return (
    <li className="rounded-md px-2 py-2 text-left hover:bg-zinc-900/70">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{statusIcon}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-zinc-200">
            {stageLabel} · {job.pageName}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">{job.message}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
            {formatTarget(job)}
          </div>
          {job.result?.reasons?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {job.result.reasons.map((reason) => (
                <span
                  key={`${job.id}-${reason.reason}`}
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                    reason.kind === 'failure'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-zinc-700 bg-zinc-900/70 text-zinc-400'
                  }`}
                >
                  {formatReason(reason.reason)} x{reason.count}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${
                job.status === 'failed'
                  ? 'bg-amber-500'
                  : job.status === 'done'
                    ? 'bg-emerald-500'
                    : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.max(6, job.progress * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{formatStatus(job.status)}</span>
            <span>{formatClock(job.finishedAt ?? job.startedAt ?? job.createdAt)}</span>
          </div>
          {job.error ? <div className="mt-1 text-[10px] text-amber-400">{job.error}</div> : null}
          {job.status === 'failed' ? (
            <button
              onClick={() => retryJob(job.id)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <RotateCcw size={10} />
              Повторить
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
