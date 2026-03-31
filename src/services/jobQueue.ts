import { v4 as uuid } from 'uuid';
import type { JobRecord, JobStage } from '../types';

export interface QueueJobTarget {
  pageId: string;
  regionIds?: string[];
  outputPath?: string;
}

export interface QueueJobPageLookup {
  fileName: string;
}

function dedupeRegionIds(regionIds?: string[]) {
  return regionIds?.length ? Array.from(new Set(regionIds)) : undefined;
}

function buildQueuedJobMessage(stage: JobStage, target: QueueJobTarget) {
  if (stage === 'ocr') {
    return target.regionIds?.length
      ? `Queued OCR for ${target.regionIds.length} region(s)`
      : 'Queued for OCR';
  }

  if (stage === 'translate') {
    return target.regionIds?.length
      ? `Queued translation for ${target.regionIds.length} region(s)`
      : 'Queued for translation';
  }

  return 'Queued for rendered export';
}

export function normalizeQueueTargets(stage: JobStage, targets: QueueJobTarget[]) {
  return targets
    .filter((target) => target.pageId)
    .map((target) => {
      if (stage === 'export') {
        return {
          pageId: target.pageId,
          ...(target.outputPath ? { outputPath: target.outputPath } : {}),
        };
      }

      return {
        pageId: target.pageId,
        ...(dedupeRegionIds(target.regionIds)?.length
          ? { regionIds: dedupeRegionIds(target.regionIds) }
          : {}),
      };
    });
}

export function buildQueueSignature(stage: JobStage, target: QueueJobTarget) {
  if (stage === 'export') {
    return target.pageId;
  }

  return `${target.pageId}:${(target.regionIds ?? []).slice().sort().join(',')}`;
}

export function collectActiveQueueSignatures(jobs: JobRecord[], stage: JobStage) {
  return new Set(
    jobs
      .filter((job) => job.stage === stage && (job.status === 'queued' || job.status === 'running'))
      .map((job) => buildQueueSignature(stage, job)),
  );
}

export function filterQueueTargets(
  stage: JobStage,
  targets: QueueJobTarget[],
  jobs: JobRecord[],
) {
  const activeSignatures = collectActiveQueueSignatures(jobs, stage);
  return targets.filter((target) => !activeSignatures.has(buildQueueSignature(stage, target)));
}

export function buildQueuedJobs(
  stage: JobStage,
  targets: QueueJobTarget[],
  pagesById: Map<string, QueueJobPageLookup>,
  createdAt: number,
): JobRecord[] {
  return targets
    .map((target, index) => {
      const page = pagesById.get(target.pageId);
      if (!page) {
        return null;
      }

      return {
        id: uuid(),
        stage,
        status: 'queued' as const,
        pageId: target.pageId,
        pageName: page.fileName,
        ...(target.regionIds?.length ? { regionIds: target.regionIds } : {}),
        ...(target.outputPath ? { outputPath: target.outputPath } : {}),
        createdAt: createdAt + index,
        startedAt: null,
        finishedAt: null,
        progress: 0,
        message: buildQueuedJobMessage(stage, target),
        error: null,
        result: null,
      };
    })
    .filter((job): job is JobRecord => job !== null);
}

export function buildRetryTarget(job: JobRecord): QueueJobTarget {
  return {
    pageId: job.pageId,
    ...(job.regionIds?.length ? { regionIds: job.regionIds } : {}),
    ...(job.outputPath ? { outputPath: job.outputPath } : {}),
  };
}
