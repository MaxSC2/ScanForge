import type { Page, ProjectMeta, ProjectRecord } from '../types';
import { pageRepository } from './pageRepository';
import { projectRepository } from './projectRepository';
import { regionRepository } from './regionRepository';

function buildProjectRecord(meta: ProjectMeta): ProjectRecord | null {
  const projectId = meta.localProjectId;
  if (!projectId) {
    return null;
  }

  return {
    id: projectId,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

function deriveFileName(page: Page | undefined, order: number, imagePath: string) {
  if (page?.fileName) {
    return page.fileName;
  }

  if (!imagePath.startsWith('data:')) {
    const normalized = imagePath.replace(/\\/g, '/');
    const segment = normalized.split('/').pop();
    if (segment) {
      return segment;
    }
  }

  return `page-${order}.png`;
}

export async function syncPagesForProject(meta: ProjectMeta, pages: Page[]) {
  const project = buildProjectRecord(meta);
  if (!project) {
    return;
  }

  await projectRepository.update(project);

  const existingPages = await pageRepository.listByProject(project.id);
  const incomingPageIds = new Set(pages.map((page) => page.id));

  await Promise.all(
    existingPages
      .filter((page) => !incomingPageIds.has(page.id))
      .map(async (page) => {
        await regionRepository.deleteByPage(page.id);
        await pageRepository.delete(page.id);
      }),
  );

  await Promise.all(
    pages.map((page, index) =>
      pageRepository.update({
        id: page.id,
        projectId: project.id,
        order: index + 1,
        imagePath: page.imagePath,
        width: page.naturalWidth,
        height: page.naturalHeight,
      }),
    ),
  );
}

export async function mergePagesWithRepository(meta: ProjectMeta, fallbackPages: Page[]) {
  if (!meta.localProjectId) {
    return fallbackPages;
  }

  const records = await pageRepository.listByProject(meta.localProjectId);
  if (records.length === 0) {
    return fallbackPages;
  }

  const fallbackMap = new Map(fallbackPages.map((page) => [page.id, page] as const));

  return records
    .sort((left, right) => left.order - right.order)
    .map((record) => {
      const fallback = fallbackMap.get(record.id);
      return {
        id: record.id,
        fileName: deriveFileName(fallback, record.order, record.imagePath),
        imagePath: record.imagePath,
        imageUrl: record.imagePath,
        naturalWidth: record.width,
        naturalHeight: record.height,
        regions: fallback?.regions ?? [],
      } satisfies Page;
    });
}
