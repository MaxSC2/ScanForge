import { useDiagnosticsStore } from '../../stores/useDiagnosticsStore';
import { useJobStore } from '../../stores/useJobStore';

export function useJobsPanel() {
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

  return {
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
  };
}
