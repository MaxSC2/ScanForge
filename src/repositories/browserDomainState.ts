import type {
  DiagnosticEntity,
  JobEntity,
  PageRecord,
  ProjectRecord,
  ProjectSettingsRecord,
  RegionRecord,
  TextStyleRecord,
} from '../types';

interface BrowserDomainState {
  projects: Record<string, ProjectRecord>;
  pages: Record<string, PageRecord>;
  regions: Record<string, RegionRecord>;
  jobs: Record<string, JobEntity>;
  diagnostics: Record<string, DiagnosticEntity>;
  projectSettings: Record<string, ProjectSettingsRecord>;
  textStyles: Record<string, TextStyleRecord>;
}

const STORAGE_KEY = 'scanforge.domain-repositories.v1';

function emptyState(): BrowserDomainState {
  return {
    projects: {},
    pages: {},
    regions: {},
    jobs: {},
    diagnostics: {},
    projectSettings: {},
    textStyles: {},
  };
}

export function cloneDomainValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readBrowserDomainState(): BrowserDomainState {
  if (typeof window === 'undefined') {
    return emptyState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BrowserDomainState>;
    return {
      projects: parsed.projects ?? {},
      pages: parsed.pages ?? {},
      regions: parsed.regions ?? {},
      jobs: parsed.jobs ?? {},
      diagnostics: parsed.diagnostics ?? {},
      projectSettings: parsed.projectSettings ?? {},
      textStyles: parsed.textStyles ?? {},
    };
  } catch {
    return emptyState();
  }
}

export function writeBrowserDomainState(state: BrowserDomainState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
