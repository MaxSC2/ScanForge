import { isTauri } from '@tauri-apps/api/core';
import {
  createDefaultTextStyle,
  DEFAULT_PROJECT_SETTINGS,
  type ProjectSettingsRecord,
  type TextStyleRecord,
} from '../types';
import { projectSettingsRepository } from './projectSettingsRepository';
import { textStyleRepository } from './textStyleRepository';

export async function ensureProjectDomainDefaults(projectId: string) {
  const [existingSettings, styles] = await Promise.all([
    projectSettingsRepository.getByProjectId(projectId),
    textStyleRepository.listByProject(projectId),
  ]);
  const runtimeDefaults = {
    ...DEFAULT_PROJECT_SETTINGS,
    ocrEngine: isTauri() ? 'windows' : DEFAULT_PROJECT_SETTINGS.ocrEngine,
  } as const;

  const defaultStyle =
    styles.find((style) => style.id === `${projectId}:default-style`) ??
    createDefaultTextStyle(projectId);

  if (!styles.some((style) => style.id === defaultStyle.id)) {
    await textStyleRepository.update(defaultStyle);
  }

  const nextSettings: ProjectSettingsRecord = {
    projectId,
    ...(existingSettings ?? runtimeDefaults),
    ...(existingSettings?.ocrEngine === 'mock' && isTauri() ? { ocrEngine: 'windows' } : {}),
    defaultTextStyleId: existingSettings?.defaultTextStyleId ?? defaultStyle.id,
  };

  await projectSettingsRepository.update(nextSettings);
  return nextSettings;
}

export interface ProjectDomainContext {
  settings: ProjectSettingsRecord;
  textStyles: TextStyleRecord[];
}

export async function loadProjectDomainContext(
  projectId: string,
): Promise<ProjectDomainContext> {
  const settings = await ensureProjectDomainDefaults(projectId);
  const textStyles = await textStyleRepository.listByProject(projectId);

  return {
    settings,
    textStyles,
  };
}
