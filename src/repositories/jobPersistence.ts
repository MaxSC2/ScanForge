import type { JobEntity, JobRecord, Page, ProjectMeta } from '../types';
import { jobRepository } from './jobRepository';

function buildJobEntity(meta: ProjectMeta, job: JobRecord): JobEntity | null {
  if (!meta.localProjectId) {
    return null;
  }

  return {
    id: job.id,
    type: job.stage === 'ocr' ? 'OCR' : 'TRANSLATE',
    status: job.status,
    projectId: meta.localProjectId,
    pageId: job.pageId,
    summary: job.result
      ? `${job.result.engine}: ${job.result.filledCount}/${job.result.regionsProcessed}`
      : job.message,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.finishedAt ?? job.startedAt ?? job.createdAt,
    ...(job.error ? { error: job.error } : {}),
  };
}

function deriveMessage(job: JobEntity) {
  if (job.status === 'queued') {
    return job.type === 'OCR' ? 'Queued for OCR' : 'Queued';
  }

  if (job.status === 'running') {
    return job.type === 'OCR' ? 'OCR in progress' : 'Job in progress';
  }

  if (job.status === 'done') {
    return job.type === 'OCR' ? 'OCR completed' : 'Job completed';
  }

  return job.error ?? 'Job failed';
}

function toJobRecord(entity: JobEntity, pagesById: Map<string, Page>): JobRecord {
  const normalizedStatus = entity.status === 'running' ? 'queued' : entity.status;
  const page = entity.pageId ? pagesById.get(entity.pageId) : undefined;

  return {
    id: entity.id,
    stage: 'ocr',
    status: normalizedStatus,
    pageId: entity.pageId ?? '',
    pageName: page?.fileName ?? 'Unknown page',
    createdAt: entity.createdAt,
    startedAt:
      normalizedStatus === 'queued'
        ? null
        : entity.status === 'done' || entity.status === 'failed'
          ? entity.createdAt
          : entity.updatedAt,
    finishedAt:
      entity.status === 'done' || entity.status === 'failed' ? entity.updatedAt : null,
    progress: entity.status === 'running' ? Math.max(entity.progress, 0.05) : entity.progress,
    message:
      entity.status === 'running'
        ? 'Recovered queued OCR job'
        : entity.summary ?? deriveMessage(entity),
    error: entity.error ?? null,
    result: null,
  };
}

export async function syncJobsForProject(meta: ProjectMeta, jobs: JobRecord[]) {
  if (!meta.localProjectId) {
    return;
  }

  const existingJobs = await jobRepository.listByProject(meta.localProjectId);
  const incomingJobs = jobs
    .map((job) => buildJobEntity(meta, job))
    .filter((job): job is JobEntity => job !== null);
  const incomingIds = new Set(incomingJobs.map((job) => job.id));

  await Promise.all(
    existingJobs
      .filter((job) => !incomingIds.has(job.id))
      .map((job) => jobRepository.delete(job.id)),
  );

  await Promise.all(incomingJobs.map((job) => jobRepository.update(job)));
}

export async function mergeJobsWithRepository(meta: ProjectMeta, pages: Page[]) {
  if (!meta.localProjectId) {
    return [] as JobRecord[];
  }

  const storedJobs = await jobRepository.listByProject(meta.localProjectId);
  if (storedJobs.length === 0) {
    return [] as JobRecord[];
  }

  const pagesById = new Map(pages.map((page) => [page.id, page] as const));
  const normalizedJobs = await Promise.all(
    storedJobs.map(async (job) => {
      if (job.status === 'running') {
        const queuedJob = {
          ...job,
          status: 'queued' as const,
          updatedAt: Date.now(),
        };
        await jobRepository.update(queuedJob);
        return toJobRecord(queuedJob, pagesById);
      }

      return toJobRecord(job, pagesById);
    }),
  );

  return normalizedJobs.sort((left, right) => right.createdAt - left.createdAt);
}
