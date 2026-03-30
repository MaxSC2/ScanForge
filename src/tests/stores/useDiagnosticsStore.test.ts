import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagnosticRepository } from '../../repositories';
import { useDiagnosticsStore } from '../../stores/useDiagnosticsStore';
import type { DiagnosticEntity } from '../../types';

describe('useDiagnosticsStore', () => {
  afterEach(() => {
    useDiagnosticsStore.setState({ entries: [], currentProjectId: null });
    vi.restoreAllMocks();
  });

  it('hydrates project diagnostics and persists merged updates', async () => {
    const persisted: DiagnosticEntity = {
      id: 'diag-1',
      projectId: 'project-1',
      scope: 'export',
      level: 'warning',
      message: 'Rendered export target selection canceled',
      timestamp: 100,
      count: 1,
      detail: 'Canceled before queueing export job',
      pageId: 'page-1',
    };

    vi.spyOn(diagnosticRepository, 'listByProject').mockResolvedValue([persisted]);
    const upsertSpy = vi
      .spyOn(diagnosticRepository, 'upsert')
      .mockImplementation(async (entry) => entry);

    await useDiagnosticsStore.getState().hydrateProject('project-1');
    useDiagnosticsStore.getState().record({
      scope: 'export',
      level: 'warning',
      message: 'Rendered export target selection canceled',
      detail: 'Canceled before queueing export job',
      projectId: 'project-1',
      pageId: 'page-1',
      timestamp: 150,
    });

    const state = useDiagnosticsStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.count).toBe(2);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0]?.[0]).toMatchObject({
      id: 'diag-1',
      projectId: 'project-1',
      count: 2,
    });
  });
});
