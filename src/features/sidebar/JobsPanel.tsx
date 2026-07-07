import { useState } from 'react';
import { WorkflowIcon } from '../../icons';
import { PipelineStatusPanel } from '../../components/PipelineStatusPanel';
import { DiagnosticsSection } from './DiagnosticsSection';
import { JobQueueSection } from './JobQueueSection';
import { useJobsPanel } from './useJobsPanel';

export function JobsPanel() {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const {
    jobs,
    processing,
    retryJob,
    clearFinished,
    diagnostics,
    clearDiagnostics,
    runningCount,
    queuedCount,
    failedCount,
    recentDiagnostics,
  } = useJobsPanel();

  return (
    <section className="flex-none border-b border-zinc-800">
      <div className="flex items-center gap-2 px-3 py-2">
        <WorkflowIcon size={12} className="text-zinc-500" />
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Задачи
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-600">{jobs.length}</span>
      </div>

      <div className="space-y-2 px-2 pb-2">
        <JobQueueSection
          jobs={jobs}
          processing={processing}
          runningCount={runningCount}
          queuedCount={queuedCount}
          failedCount={failedCount}
          retryJob={retryJob}
          clearFinished={clearFinished}
        />

        <button
          onClick={() => setPipelineOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
        >
          <WorkflowIcon size={11} />
          <span className="flex-1">Пайплайн страниц</span>
          <span className={`transition-transform ${pipelineOpen ? 'rotate-0' : '-rotate-90'}`}>
            ▸
          </span>
        </button>
        {pipelineOpen && <PipelineStatusPanel />}

        <DiagnosticsSection
          diagnosticsOpen={diagnosticsOpen}
          onToggle={() => setDiagnosticsOpen((state) => !state)}
          diagnostics={diagnostics}
          recentDiagnostics={recentDiagnostics}
          clearDiagnostics={clearDiagnostics}
        />
      </div>
    </section>
  );
}
