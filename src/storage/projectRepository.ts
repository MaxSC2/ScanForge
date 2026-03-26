import type { LocalProjectSaveResult, LocalProjectSummary, ProjectFile } from '../types';

export interface ProjectRepository {
  saveProject(project: ProjectFile): Promise<LocalProjectSaveResult>;
  loadProject(id: string): Promise<ProjectFile>;
  loadLatestProject(): Promise<ProjectFile | null>;
  listProjects(): Promise<LocalProjectSummary[]>;
}
