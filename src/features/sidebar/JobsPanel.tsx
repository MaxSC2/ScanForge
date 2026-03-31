import { useState } from 'react';
import { Workflow } from 'lucide-react';
import { DiagnosticsSection } from './DiagnosticsSection';
import { JobQueueSection } from './JobQueueSection';
import { useJobsPanel } from './useJobsPanel';

export function JobsPanel() {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
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
        <Workflow size={12} className="text-zinc-500" />
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
