import type {
  LocalProjectLoadResult,
  LocalProjectSaveResult,
  LocalProjectSummary,
  ProjectFile,
} from '../types';

export interface ProjectRepository {
  saveProject(project: ProjectFile): Promise<LocalProjectSaveResult>;
  loadProject(id: string): Promise<LocalProjectLoadResult>;
  loadLatestProject(): Promise<LocalProjectLoadResult | null>;
  listProjects(): Promise<LocalProjectSummary[]>;
}
