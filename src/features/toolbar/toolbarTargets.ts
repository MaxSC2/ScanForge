interface ToolbarTargetArgs {
  activePageId: string | null;
  selectedPageIds: string[];
  selectedRegionId: string | null;
}

interface ToolbarJobTarget {
  pageId: string;
  regionIds?: string[];
}

function buildTargets({
  activePageId,
  selectedPageIds,
  selectedRegionId,
}: ToolbarTargetArgs): ToolbarJobTarget[] {
  if (selectedRegionId && activePageId) {
    return [{ pageId: activePageId, regionIds: [selectedRegionId] }];
  }

  const pageIds = selectedPageIds.length > 0
    ? selectedPageIds
    : activePageId
      ? [activePageId]
      : [];

  return pageIds.map((pageId) => ({ pageId }));
}

export function buildOcrTargets(args: ToolbarTargetArgs) {
  return buildTargets(args);
}

export function buildTranslationTargets(args: ToolbarTargetArgs) {
  return buildTargets(args);
}
