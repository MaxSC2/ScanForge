import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from '../repositories/browserDomainState';
import { ensureProjectDomainDefaults } from '../repositories/projectDefaults';
import type {
  LocalProjectLoadResult,
  LocalProjectSaveResult,
  LocalProjectSummary,
  PageRecord,
  ProjectFile,
  ProjectRecord,
  Region,
  RegionRecord,
} from '../types';
import { normalizeRegion } from '../types/region';
import type { ProjectRepository } from './projectRepository';

interface BrowserProjectEnvelope {
  latestProjectId: string | null;
  projects: Record<string, ProjectFile>;
  summaries: LocalProjectSummary[];
}

const STORAGE_KEY = 'scanforge.local-projects.v1';

function emptyEnvelope(): BrowserProjectEnvelope {
  return {
    latestProjectId: null,
    projects: {},
    summaries: [],
  };
}

function cloneProject(project: ProjectFile): ProjectFile {
  return JSON.parse(JSON.stringify(project)) as ProjectFile;
}

function readEnvelope(): BrowserProjectEnvelope {
  if (typeof window === 'undefined') return emptyEnvelope();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyEnvelope();

  try {
    return JSON.parse(raw) as BrowserProjectEnvelope;
  } catch {
    return emptyEnvelope();
  }
}

function writeEnvelope(envelope: BrowserProjectEnvelope) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

function buildSummary(project: ProjectFile): LocalProjectSummary {
  const id = project.meta.localProjectId ?? crypto.randomUUID();
  return {
    id,
    name: project.meta.name,
    createdAt: project.meta.createdAt,
    updatedAt: project.meta.updatedAt,
    pageCount: project.pages.length,
    lastOpenedAt: Date.now(),
  };
}

function deriveFileName(page: PageRecord) {
  if (!page.imagePath.startsWith('data:')) {
    const normalized = page.imagePath.replace(/\\/g, '/');
    const segment = normalized.split('/').pop();
    if (segment) {
      return segment;
    }
  }

  return `page-${page.order}.png`;
}

function sortRegionRecords(records: RegionRecord[], fallbackMap: Map<string, Region>) {
  return [...records].sort((left, right) => {
    const leftOrder = left.order || fallbackMap.get(left.id)?.order;
    const rightOrder = right.order || fallbackMap.get(right.id)?.order;

    if (typeof leftOrder === 'number' || typeof rightOrder === 'number') {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }

    if (left.y !== right.y) return left.y - right.y;
    if (left.x !== right.x) return left.x - right.x;
    return left.id.localeCompare(right.id);
  });
}

function writeProjectIntoDomainState(
  state: ReturnType<typeof readBrowserDomainState>,
  project: ProjectFile,
) {
  const projectId = project.meta.localProjectId ?? crypto.randomUUID();
  state.projects[projectId] = cloneDomainValue({
    id: projectId,
    name: project.meta.name,
    createdAt: project.meta.createdAt,
    updatedAt: project.meta.updatedAt,
  } satisfies ProjectRecord);

  const incomingPageIds = new Set(project.pages.map((page) => page.id));
  const existingPageIds = Object.values(state.pages)
    .filter((page) => page.projectId === projectId)
    .map((page) => page.id);

  for (const pageId of existingPageIds) {
    if (incomingPageIds.has(pageId)) continue;
    delete state.pages[pageId];
    for (const region of Object.values(state.regions)) {
      if (region.pageId === pageId) {
        delete state.regions[region.id];
      }
    }
  }

  for (const [index, page] of project.pages.entries()) {
    state.pages[page.id] = cloneDomainValue({
      id: page.id,
      projectId,
      order: index + 1,
      imagePath: page.imageDataUrl,
      width: page.naturalWidth,
      height: page.naturalHeight,
    } satisfies PageRecord);

    const incomingRegionIds = new Set(
      page.regions.map((region) => {
        if (typeof region === 'object' && region && 'id' in region) {
          return String(region.id);
        }
        return '';
      }),
    );

    for (const region of Object.values(state.regions)) {
      if (region.pageId === page.id && !incomingRegionIds.has(region.id)) {
        delete state.regions[region.id];
      }
    }

    for (const rawRegion of page.regions) {
      const region = normalizeRegion(rawRegion as Region);
      state.regions[region.id] = cloneDomainValue({
        id: region.id,
        pageId: page.id,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        rotation: region.rotation,
        label: region.label,
        kind: region.kind,
        order: region.order,
        orientation: region.orientation,
        sourceText: region.sourceText,
        ...(region.sourceLanguage ? { sourceLanguage: region.sourceLanguage } : {}),
        translatedText: region.translatedText,
        status: region.status,
        ocrStatus: region.ocrStatus,
        ...(region.ocrEngine ? { ocrEngine: region.ocrEngine } : {}),
        ...(typeof region.ocrUpdatedAt === 'number' ? { ocrUpdatedAt: region.ocrUpdatedAt } : {}),
        ...(region.targetLanguage ? { targetLanguage: region.targetLanguage } : {}),
        translationStatus: region.translationStatus,
        ...(region.translationProvider
          ? { translationProvider: region.translationProvider }
          : {}),
        ...(typeof region.translationUpdatedAt === 'number'
          ? { translationUpdatedAt: region.translationUpdatedAt }
          : {}),
        notes: region.notes,
        locked: region.locked,
        visible: region.visible,
        ...(region.textStyleId ? { textStyleId: region.textStyleId } : {}),
        ...(typeof region.ocrConfidence === 'number'
          ? { ocrConfidence: region.ocrConfidence }
          : {}),
      } satisfies RegionRecord);
    }
  }
}

function ensureEnvelopeMigrated() {
  const envelope = readEnvelope();
  const state = readBrowserDomainState();
  let changed = false;

  for (const [projectId, project] of Object.entries(envelope.projects)) {
    if (state.projects[projectId]) {
      continue;
    }

    const storedProject = cloneProject({
      ...project,
      meta: {
        ...project.meta,
        localProjectId: project.meta.localProjectId ?? projectId,
      },
    });
    writeProjectIntoDomainState(state, storedProject);
    changed = true;
  }

  if (changed) {
    writeBrowserDomainState(state);
  }

  return { envelope, state };
}

function buildProjectFromDomain(
  projectId: string,
  state: ReturnType<typeof readBrowserDomainState>,
  envelope: BrowserProjectEnvelope,
): ProjectFile {
  const project = state.projects[projectId];
  if (!project) {
    throw new Error(`Local project ${projectId} was not found`);
  }

  const fallback = envelope.projects[projectId];
  const fallbackPages = new Map((fallback?.pages ?? []).map((page) => [page.id, page] as const));

  const pages = Object.values(state.pages)
    .filter((page) => page.projectId === projectId)
    .sort((left, right) => left.order - right.order)
    .map((page) => {
      const fallbackPage = fallbackPages.get(page.id);
      const fallbackRegions = new Map(
        (fallbackPage?.regions ?? []).map((region) => {
          const normalized = normalizeRegion(region as Region);
          return [normalized.id, normalized] as const;
        }),
      );

      const regions = sortRegionRecords(
        Object.values(state.regions).filter((region) => region.pageId === page.id),
        fallbackRegions,
      ).map((region, index) =>
        normalizeRegion({
          id: region.id,
          label: region.label || fallbackRegions.get(region.id)?.label || `Region ${index + 1}`,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          rotation: region.rotation,
          orientation: region.orientation,
          sourceText: region.sourceText,
          sourceLanguage: region.sourceLanguage,
          translatedText: region.translatedText,
          status: region.status,
          ocrStatus: region.ocrStatus,
          ocrEngine: region.ocrEngine,
          ocrUpdatedAt: region.ocrUpdatedAt,
          targetLanguage: region.targetLanguage,
          translationStatus: region.translationStatus,
          translationProvider: region.translationProvider,
          translationUpdatedAt: region.translationUpdatedAt,
          kind: region.kind || fallbackRegions.get(region.id)?.kind || 'speech',
          order: region.order || fallbackRegions.get(region.id)?.order || index + 1,
          notes: region.notes ?? fallbackRegions.get(region.id)?.notes ?? '',
          locked: region.locked,
          visible: region.visible,
          textStyleId: region.textStyleId ?? fallbackRegions.get(region.id)?.textStyleId,
          ocrConfidence: region.ocrConfidence,
        }),
      );

      return {
        id: page.id,
        fileName: fallbackPage?.fileName ?? deriveFileName(page),
        imageDataUrl: page.imagePath,
        naturalWidth: page.width,
        naturalHeight: page.height,
        regions,
      };
    });

  const activePageId =
    fallback?.activePageId && pages.some((page) => page.id === fallback.activePageId)
      ? fallback.activePageId
      : pages[0]?.id ?? null;

  return {
    version: 1,
    meta: {
      localProjectId: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    pages,
    activePageId,
  };
}

export const browserProjectRepository: ProjectRepository = {
  async saveProject(project) {
    const { envelope, state } = ensureEnvelopeMigrated();
    const localProjectId = project.meta.localProjectId ?? crypto.randomUUID();
    const storedProject = cloneProject({
      ...project,
      meta: {
        ...project.meta,
        localProjectId,
      },
    });

    writeProjectIntoDomainState(state, storedProject);
    writeBrowserDomainState(state);
    await ensureProjectDomainDefaults(localProjectId);

    const summary = buildSummary(storedProject);
    const summaryMap = new Map(envelope.summaries.map((item) => [item.id, item] as const));

    summaryMap.set(localProjectId, summary);
    envelope.projects[localProjectId] = storedProject;
    envelope.latestProjectId = localProjectId;
    envelope.summaries = [...summaryMap.values()].sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );
    writeEnvelope(envelope);

    return {
      project: cloneProject(storedProject),
      summary,
    } satisfies LocalProjectSaveResult;
  },

  async loadProject(id) {
    const { envelope, state } = ensureEnvelopeMigrated();
    if (!state.projects[id] && envelope.projects[id]) {
      writeProjectIntoDomainState(state, envelope.projects[id]);
      writeBrowserDomainState(state);
    }
    await ensureProjectDomainDefaults(id);

    let warning: string | null = null;
    let source: LocalProjectLoadResult['source'] = 'domain';
    let project: ProjectFile;

    try {
      project = buildProjectFromDomain(id, state, envelope);
    } catch (error) {
      const backupProject = envelope.projects[id];
      if (!backupProject) {
        throw error;
      }

      project = cloneProject(backupProject);
      source = 'snapshot';
      warning = 'Domain state was incomplete. Restored from backup snapshot.';
      console.warn('Browser project restored from backup snapshot:', error);
    }

    envelope.latestProjectId = id;
    const summary = envelope.summaries.find((item) => item.id === id);
    if (summary) {
      summary.lastOpenedAt = Date.now();
    }
    writeEnvelope(envelope);

    return {
      project: cloneProject(project),
      source,
      warning,
    } satisfies LocalProjectLoadResult;
  },

  async loadLatestProject() {
    const { envelope, state } = ensureEnvelopeMigrated();
    const latestProjectId =
      envelope.latestProjectId ??
      Object.values(state.projects).sort((left, right) => right.updatedAt - left.updatedAt)[0]?.id ??
      null;

    if (!latestProjectId) {
      return null;
    }

    return this.loadProject(latestProjectId);
  },

  async listProjects() {
    const { envelope, state } = ensureEnvelopeMigrated();
    const summaryById = new Map(envelope.summaries.map((item) => [item.id, item] as const));

    return Object.values(state.projects)
      .map((project) => ({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        pageCount: Object.values(state.pages).filter((page) => page.projectId === project.id).length,
        lastOpenedAt: summaryById.get(project.id)?.lastOpenedAt ?? null,
      }))
      .sort((left, right) => {
        const leftRank = left.lastOpenedAt ?? left.updatedAt;
        const rightRank = right.lastOpenedAt ?? right.updatedAt;
        return rightRank - leftRank;
      });
  },
};
