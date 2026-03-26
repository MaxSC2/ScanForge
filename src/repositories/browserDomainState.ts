import type { JobEntity, PageRecord, ProjectRecord, RegionRecord } from '../types';

interface BrowserDomainState {
  projects: Record<string, ProjectRecord>;
  pages: Record<string, PageRecord>;
  regions: Record<string, RegionRecord>;
  jobs: Record<string, JobEntity>;
}

const STORAGE_KEY = 'scanforge.domain-repositories.v1';

function emptyState(): BrowserDomainState {
  return {
    projects: {},
    pages: {},
    regions: {},
    jobs: {},
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
    return JSON.parse(raw) as BrowserDomainState;
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
