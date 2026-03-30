import { browserProjectRepository } from './browserProjectRepository';
import type { ProjectRepository } from './projectRepository';
import { tauriProjectRepository } from './tauriProjectRepository';
import { isDesktopRuntime } from '../utils/runtime';

let repository: ProjectRepository | null = null;

export function getProjectRepository(): ProjectRepository {
  const nextRepository = isDesktopRuntime() ? tauriProjectRepository : browserProjectRepository;
  if (!repository || repository !== nextRepository) {
    repository = nextRepository;
  }

  return repository;
}
