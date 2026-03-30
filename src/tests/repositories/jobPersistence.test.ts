import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeJobsWithRepository, syncJobsForProject } from '../../repositories/jobPersistence';
import { jobRepository } from '../../repositories/jobRepository';
import type { JobEntity, JobRecord, Page, ProjectMeta } from '../../types';

describe('jobPersistence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes structured job result into resultJson when syncing jobs', async () => {
    const meta: ProjectMeta = {
      localProjectId: 'project-1',
      name: 'ScanForge',
      createdAt: 1,
      updatedAt: 2,
    };
    const job: JobRecord = {
      id: 'job-1',
      stage: 'export',
      status: 'done',
      pageId: 'page-1',
      pageName: 'Page 1',
      createdAt: 10,
      startedAt: 11,
      finishedAt: 12,
      progress: 1,
      message: 'rendered-png: rendered 1/1, sha256 deadbeef',
      error: null,
      result: {
        provider: 'rendered-png',
        regionsProcessed: 1,
        appliedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        artifactHash: 'deadbeefdeadbeef',
      },
    };

    vi.spyOn(jobRepository, 'listByProject').mockResolvedValue([]);
    const updateSpy = vi.spyOn(jobRepository, 'update').mockImplementation(async (entity) => entity);
    const deleteSpy = vi.spyOn(jobRepository, 'delete').mockResolvedValue();

    await syncJobsForProject(meta, [job]);

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const persisted = updateSpy.mock.calls[0]?.[0] as JobEntity;
    expect(persisted.resultJson).toBeTruthy();
    expect(JSON.parse(persisted.resultJson ?? '{}')).toMatchObject({
      provider: 'rendered-png',
      artifactHash: 'deadbeefdeadbeef',
    });
  });

  it('restores structured job result from resultJson after reload', async () => {
    const meta: ProjectMeta = {
      localProjectId: 'project-1',
      name: 'ScanForge',
      createdAt: 1,
      updatedAt: 2,
    };
    const pages: Page[] = [
      {
        id: 'page-1',
        fileName: 'page-1.png',
        imageDataUrl: 'data:image/png;base64,AAAA',
        naturalWidth: 100,
        naturalHeight: 100,
        regions: [],
      },
    ];
    const storedJob: JobEntity = {
      id: 'job-1',
      type: 'EXPORT',
      status: 'done',
      projectId: 'project-1',
      pageId: 'page-1',
      progress: 1,
      createdAt: 10,
      updatedAt: 12,
      summary: 'rendered-png: rendered 1/1, sha256 deadbeef',
      resultJson: JSON.stringify({
        provider: 'rendered-png',
        regionsProcessed: 1,
        appliedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        artifactHash: 'deadbeefdeadbeef',
      }),
    };

    vi.spyOn(jobRepository, 'listByProject').mockResolvedValue([storedJob]);

    const jobs = await mergeJobsWithRepository(meta, pages);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.result).toMatchObject({
      provider: 'rendered-png',
      artifactHash: 'deadbeefdeadbeef',
    });
    expect(jobs[0]?.message).toContain('sha256 deadbeef');
  });
});
