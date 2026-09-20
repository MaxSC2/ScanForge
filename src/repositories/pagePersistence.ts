import { invoke } from '@tauri-apps/api/core';
import type { Page, ProjectMeta, ProjectRecord } from '../types';
import { ensureProjectDomainDefaults } from './projectDefaults';
import { pageRepository } from './pageRepository';
import { projectRepository } from './projectRepository';
import { regionRepository } from './regionRepository';
import { isDesktopRuntime } from '../utils/runtime';

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

function buildMissingAssetPlaceholder(fileName: string, imagePath: string) {
  const safeName = fileName.replace(/[<>&"']/g, '');
  const safePath =
    imagePath
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/[<>&"']/g, '') ?? 'unknown';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#18181b"/><rect x="40" y="40" width="820" height="1120" rx="24" fill="none" stroke="#52525b" stroke-width="4"/><text x="450" y="500" text-anchor="middle" fill="#f4f4f5" font-family="sans-serif" font-size="38">Asset unavailable</text><text x="450" y="560" text-anchor="middle" fill="#a1a1aa" font-family="sans-serif" font-size="24">${safeName}</text><text x="450" y="620" text-anchor="middle" fill="#71717a" font-family="sans-serif" font-size="18">Stored asset: ${safePath}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isUsableFallbackImageUrl(value: string | undefined) {
  return Boolean(value && /^(data:|blob:|https?:)/i.test(value));
}

export async function syncPagesForProject(meta: ProjectMeta, pages: Page[]) {
  const project = buildProjectRecord(meta);
  if (!project) {
    return;
  }

  await projectRepository.update(project);
  await ensureProjectDomainDefaults(project.id);

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

  const resolvedRecords = await Promise.all(
    records
      .sort((left, right) => left.order - right.order)
      .map(async (record) => {
        const isDataUrl = record.imagePath.startsWith('data:');
        const fallback = fallbackMap.get(record.id);
        let imageUrl = isDataUrl ? record.imagePath : '';

        if (!isDataUrl && isDesktopRuntime()) {
          try {
            imageUrl = await invoke<string>('load_page_image', {
              imagePath: record.imagePath,
            });
          } catch {
            imageUrl = '';
          }
        }

        if (!isUsableFallbackImageUrl(imageUrl)) {
          const embeddedFallback = fallback?.imageUrl;
          if (isUsableFallbackImageUrl(embeddedFallback)) {
            imageUrl = embeddedFallback;
          } else {
            imageUrl = buildMissingAssetPlaceholder(
              deriveFileName(fallback, record.order, record.imagePath),
              record.imagePath,
            );
            console.warn(
              `[ScanForge][Recovery] asset unavailable for page ${record.id}; using recovery placeholder`,
            );
          }
        }

        return {
          id: record.id,
          fileName: deriveFileName(fallback, record.order, record.imagePath),
          imagePath: record.imagePath,
          imageUrl,
          naturalWidth: record.width,
          naturalHeight: record.height,
          regions: fallback?.regions ?? [],
        } satisfies Page;
      }),
  );

  return resolvedRecords;
}
