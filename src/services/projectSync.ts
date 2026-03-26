import type { ProjectMeta } from '../types';
import { syncPagesForProject, syncRegionsForPages } from '../repositories';
import { getProjectRepository } from '../storage';
import { usePageStore } from '../stores/usePageStore';
import { useProjectStore } from '../stores/useProjectStore';

const projectRepository = getProjectRepository();

export async function ensureProjectDomainStatePersisted(): Promise<ProjectMeta> {
  let meta = useProjectStore.getState().meta;
  if (!meta.localProjectId) {
    const project = await usePageStore.getState().toProjectFile();
    const result = await projectRepository.saveProject(project);
    meta = result.project.meta;
    if (useProjectStore.getState().meta.localProjectId !== meta.localProjectId) {
      useProjectStore.getState().setMeta(meta);
    }
  }

  const current = usePageStore.getState();
  await syncPagesForProject(meta, current.pages);
  await syncRegionsForPages(current.pages);
  return useProjectStore.getState().meta;
}
