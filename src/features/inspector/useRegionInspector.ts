import { useEffect, useState } from 'react';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useToastStore } from '../../stores/useToastStore';
import type { Region } from '../../types';
import type { InspectorView } from './inspectorShared';

export function useRegionInspector() {
  const [activeView, setActiveView] = useState<InspectorView>('details');

  const selectedRegionId = useRegionStore((state) => state.selectedRegionId);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const deleteRegion = useRegionStore((state) => state.deleteRegion);
  const duplicateRegion = useRegionStore((state) => state.duplicateRegion);

  const queueOcrJobs = useJobStore((state) => state.queueOcrJobs);
  const pushToast = useToastStore((state) => state.push);

  const activePage = usePageStore((state) => {
    const id = state.activePageId;
    return id ? state.pages.find((page) => page.id === id) : undefined;
  });

  const region = activePage?.regions.find((item) => item.id === selectedRegionId);

  useEffect(() => {
    if (selectedRegionId) {
      setActiveView('details');
    }
  }, [selectedRegionId]);

  const update = (patch: Partial<Region>) => {
    if (!activePage || !region) return;
    updateRegion(activePage.id, region.id, patch);
  };

  const rerunOcr = () => {
    if (!activePage || !region) return;

    const queued = queueOcrJobs([{ pageId: activePage.id, regionIds: [region.id] }]);
    if (queued === 0) {
      pushToast('OCR already queued for this region', 'info');
    }
  };

  return {
    activeView,
    setActiveView,
    activePage,
    region,
    update,
    rerunOcr,
    deleteRegion,
    duplicateRegion,
  };
}
