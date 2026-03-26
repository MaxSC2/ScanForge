import { isTauri } from '@tauri-apps/api/core';
import { browserProjectRepository } from './browserProjectRepository';
import type { ProjectRepository } from './projectRepository';
import { tauriProjectRepository } from './tauriProjectRepository';

let repository: ProjectRepository | null = null;

export function getProjectRepository(): ProjectRepository {
  if (!repository) {
    repository = isTauri() ? tauriProjectRepository : browserProjectRepository;
  }

  return repository;
}
