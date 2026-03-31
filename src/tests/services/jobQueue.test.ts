import { describe, expect, it } from 'vitest';
import {
  buildQueueSignature,
  buildQueuedJobs,
  buildRetryTarget,
  collectActiveQueueSignatures,
  filterQueueTargets,
  normalizeQueueTargets,
} from '../../services/jobQueue';
import type { JobRecord } from '../../types';

describe('jobQueue service', () => {
  it('normalizes region targets by deduping region ids', () => {
    expect(
      normalizeQueueTargets('ocr', [
        { pageId: 'page-1', regionIds: ['r1', 'r1', 'r2'] },
      ]),
    ).toEqual([{ pageId: 'page-1', regionIds: ['r1', 'r2'] }]);
  });

  it('keeps export output path during normalization', () => {
    expect(
      normalizeQueueTargets('export', [
        { pageId: 'page-1', outputPath: 'C:/tmp/out.png' },
      ]),
    ).toEqual([{ pageId: 'page-1', outputPath: 'C:/tmp/out.png' }]);
  });

  it('builds queue signatures by stage semantics', () => {
    expect(buildQueueSignature('export', { pageId: 'page-1' })).toBe('page-1');
    expect(buildQueueSignature('translate', { pageId: 'page-1', regionIds: ['b', 'a'] })).toBe(
      'page-1:a,b',
    );
  });

  it('collects only active queued or running signatures', () => {
    const jobs: JobRecord[] = [
      {
        id: 'job-1',
        stage: 'ocr',
        status: 'queued',
        pageId: 'page-1',
        pageName: 'one.png',
        createdAt: 1,
        startedAt: null,
        finishedAt: null,
        progress: 0,
        message: 'Queued',
        error: null,
        result: null,
      },
      {
        id: 'job-2',
        stage: 'ocr',
        status: 'done',
        pageId: 'page-2',
        pageName: 'two.png',
        createdAt: 2,
        startedAt: 2,
        finishedAt: 3,
        progress: 1,
        message: 'Done',
        error: null,
        result: null,
      },
    ];

    expect(collectActiveQueueSignatures(jobs, 'ocr')).toEqual(new Set(['page-1:']));
  });

  it('filters targets already present in active queue', () => {
    const jobs: JobRecord[] = [
      {
        id: 'job-1',
        stage: 'translate',
        status: 'running',
        pageId: 'page-1',
        pageName: 'one.png',
        regionIds: ['r1'],
        createdAt: 1,
        startedAt: 2,
        finishedAt: null,
        progress: 0.5,
        message: 'Running',
        error: null,
        result: null,
      },
    ];

    expect(
      filterQueueTargets(
        'translate',
        [
          { pageId: 'page-1', regionIds: ['r1'] },
          { pageId: 'page-2' },
        ],
        jobs,
      ),
    ).toEqual([{ pageId: 'page-2' }]);
  });

  it('builds queued jobs only for known pages', () => {
    const pagesById = new Map([
      ['page-1', { fileName: 'one.png' }],
    ]);

    const jobs = buildQueuedJobs(
      'translate',
      [{ pageId: 'page-1', regionIds: ['r1'] }, { pageId: 'missing' }],
      pagesById,
      100,
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      stage: 'translate',
      pageId: 'page-1',
      pageName: 'one.png',
      regionIds: ['r1'],
      createdAt: 100,
      message: 'Queued translation for 1 region(s)',
    });
  });

  it('builds retry targets from existing jobs', () => {
    expect(
      buildRetryTarget({
        id: 'job-1',
        stage: 'export',
        status: 'failed',
        pageId: 'page-1',
        pageName: 'one.png',
        outputPath: 'C:/tmp/out.png',
        createdAt: 1,
        startedAt: 2,
        finishedAt: 3,
        progress: 1,
        message: 'Failed',
        error: 'boom',
        result: null,
      }),
    ).toEqual({ pageId: 'page-1', outputPath: 'C:/tmp/out.png' });
  });
});
