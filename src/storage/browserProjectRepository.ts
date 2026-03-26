import type { LocalProjectSaveResult, LocalProjectSummary, ProjectFile } from '../types';
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

export const browserProjectRepository: ProjectRepository = {
  async saveProject(project) {
    const envelope = readEnvelope();
    const localProjectId = project.meta.localProjectId ?? crypto.randomUUID();
    const storedProject = cloneProject({
      ...project,
      meta: {
        ...project.meta,
        localProjectId,
      },
    });
    const summary = buildSummary(storedProject);
    const summaryMap = new Map(
      envelope.summaries.map((item) => [item.id, item] as const),
    );

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
    const envelope = readEnvelope();
    const project = envelope.projects[id];
    if (!project) {
      throw new Error(`Local project ${id} was not found`);
    }

    envelope.latestProjectId = id;
    const summary = envelope.summaries.find((item) => item.id === id);
    if (summary) {
      summary.lastOpenedAt = Date.now();
      writeEnvelope(envelope);
    }

    return cloneProject(project);
  },

  async loadLatestProject() {
    const envelope = readEnvelope();
    const id = envelope.latestProjectId;
    if (!id) return null;
    const project = envelope.projects[id];
    return project ? cloneProject(project) : null;
  },

  async listProjects() {
    const envelope = readEnvelope();
    return [...envelope.summaries].sort((left, right) => right.updatedAt - left.updatedAt);
  },
};
