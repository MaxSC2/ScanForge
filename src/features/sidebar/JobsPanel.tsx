import {
  CircleAlert,
  CircleCheckBig,
  Eraser,
  Languages,
  LoaderCircle,
  RotateCcw,
  ScanText,
  Workflow,
} from 'lucide-react';
import { useDiagnosticsStore } from '../../stores/useDiagnosticsStore';
import { useJobStore } from '../../stores/useJobStore';

function formatClock(value: number | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

function formatTarget(job: { regionIds?: string[] }) {
  if (!job.regionIds?.length) {
    return 'page';
  }

  return job.regionIds.length === 1 ? '1 region' : `${job.regionIds.length} regions`;
}

function formatReason(reason: string) {
  switch (reason) {
    case 'already_filled':
      return 'already filled';
    case 'invalid_bounds':
      return 'invalid bounds';
    case 'no_text':
      return 'no text';
    case 'locked':
      return 'locked';
    default:
      return reason.replace(/_/g, ' ');
  }
}

function formatScope(scope: string) {
  switch (scope) {
    case 'ocr':
      return 'OCR';
    case 'translation':
      return 'Translation';
    case 'export':
      return 'Export';
    case 'recovery':
      return 'Recovery';
    case 'autosave':
      return 'Autosave';
    case 'project':
      return 'Project';
    default:
      return 'Runtime';
  }
}

function diagnosticDotClass(level: string) {
  switch (level) {
    case 'error':
      return 'bg-red-400';
    case 'warning':
      return 'bg-amber-400';
    default:
      return 'bg-zinc-500';
  }
}

export function JobsPanel() {
  const jobs = useJobStore((state) => state.jobs);
  const processing = useJobStore((state) => state.processing);
  const retryJob = useJobStore((state) => state.retryJob);
  const clearFinished = useJobStore((state) => state.clearFinished);
  const diagnostics = useDiagnosticsStore((state) => state.entries);
  const clearDiagnostics = useDiagnosticsStore((state) => state.clear);

  const runningCount = jobs.filter((job) => job.status === 'running').length;
  const queuedCount = jobs.filter((job) => job.status === 'queued').length;
  const failedCount = jobs.filter((job) => job.status === 'failed').length;
  const recentDiagnostics = diagnostics.slice(0, 6);

  return (
    <section className="flex-none border-b border-zinc-800">
      <div className="flex items-center gap-2 px-3 py-2">
        <Workflow size={12} className="text-zinc-500" />
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Jobs
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-600">{jobs.length}</span>
      </div>

      <div className="space-y-2 px-2 pb-2">
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
            <div className="text-zinc-600">Running</div>
            <div className="mt-1 text-xs font-semibold text-zinc-200">{runningCount}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
            <div className="text-zinc-600">Queued</div>
            <div className="mt-1 text-xs font-semibold text-zinc-200">{queuedCount}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
            <div className="text-zinc-600">Failed</div>
            <div className="mt-1 text-xs font-semibold text-zinc-200">{failedCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-500">
            {processing ? (
              <LoaderCircle size={11} className="animate-spin text-indigo-400" />
            ) : (
              <ScanText size={11} className="text-zinc-500" />
            )}
            {processing ? 'Pipeline worker active' : 'Pipeline worker idle'}
          </div>

          <button
            onClick={clearFinished}
            className="ml-auto inline-flex h-7 items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            title="Clear completed and failed jobs"
          >
            <Eraser size={11} />
            Clear
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
          {jobs.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] font-medium text-zinc-400">Job queue is empty</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Run OCR or translation for the selected page from the top toolbar.
              </p>
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto p-1">
              {jobs.map((job) => {
                const stageLabel = job.stage === 'ocr' ? 'OCR' : 'TR';
                const statusIcon =
                  job.status === 'running' ? (
                    <LoaderCircle size={12} className="animate-spin text-indigo-400" />
                  ) : job.status === 'done' ? (
                    <CircleCheckBig size={12} className="text-emerald-400" />
                  ) : job.status === 'failed' ? (
                    <CircleAlert size={12} className="text-amber-400" />
                  ) : job.stage === 'translate' ? (
                    <Languages size={12} className="text-zinc-500" />
                  ) : (
                    <ScanText size={12} className="text-zinc-500" />
                  );

                return (
                  <li key={job.id} className="rounded-md px-2 py-2 text-left hover:bg-zinc-900/70">
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
                          <span>{job.status}</span>
                          <span>{formatClock(job.finishedAt ?? job.startedAt ?? job.createdAt)}</span>
                        </div>
                        {job.error && (
                          <div className="mt-1 text-[10px] text-amber-400">{job.error}</div>
                        )}
                        {job.status === 'failed' && (
                          <button
                            onClick={() => retryJob(job.id)}
                            className="mt-2 inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            <RotateCcw size={10} />
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Diagnostics
            </span>
            <span className="text-[10px] tabular-nums text-zinc-600">{diagnostics.length}</span>
            <button
              onClick={clearDiagnostics}
              className="inline-flex h-6 items-center rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              title="Clear diagnostics log"
            >
              Clear
            </button>
          </div>

          {recentDiagnostics.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] font-medium text-zinc-400">No recent diagnostics</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Pipeline warnings and recovery errors will appear here.
              </p>
            </div>
          ) : (
            <ul className="max-h-40 overflow-y-auto p-1">
              {recentDiagnostics.map((entry) => (
                <li key={entry.id} className="rounded-md px-2 py-2 hover:bg-zinc-900/70">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 flex-none rounded-full ${diagnosticDotClass(entry.level)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[11px] font-medium text-zinc-200">
                          {entry.message}
                        </div>
                        {entry.count > 1 ? (
                          <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-400">
                            x{entry.count}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-600">
                        <span>{formatScope(entry.scope)}</span>
                        <span>{entry.level}</span>
                        <span>{formatClock(entry.timestamp)}</span>
                      </div>
                      {entry.detail ? (
                        <div className="mt-1 break-words text-[10px] text-zinc-500" title={entry.detail}>
                          {entry.detail}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
