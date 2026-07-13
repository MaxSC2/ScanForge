import { useEffect } from 'react';
import { useProjectDomainStore } from '../stores/useProjectDomainStore';
import { ensureFontsLoaded } from '../services/fontLoader';

let loadedProjectId: string | null = null;

export function useFontLoader() {
  const projectId = useProjectDomainStore((s) => s.projectId);
  const textStyles = useProjectDomainStore((s) => s.textStyles);

  useEffect(() => {
    if (!projectId || projectId === loadedProjectId) return;
    loadedProjectId = projectId;

    const families = textStyles.map((s) => s.fontFamily);
    ensureFontsLoaded(families);
  }, [projectId, textStyles]);
}
