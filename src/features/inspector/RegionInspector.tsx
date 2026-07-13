import { Crosshair } from 'lucide-react';
import { LayersIcon, SettingsIcon } from '../../icons';
import { GlossaryPanel } from '../../components/GlossaryPanel';
import { MemoryPanel } from '../../components/MemoryPanel';
import { ImageProcessingPanel } from '../../components/ImageProcessingPanel';
import { ProjectSettingsPanel } from '../settings/ProjectSettingsPanel';
import { RegionDetailsPanel } from './RegionDetailsPanel';
import {
  InspectorEmptyState,
  InspectorHeader,
  RegionListPanel,
} from './inspectorShared';
import { useRegionInspector } from './useRegionInspector';

export function RegionInspector() {
  const {
    activeView,
    setActiveView,
    activePage,
    region,
    update,
    rerunOcr,
    deleteRegion,
    duplicateRegion,
    splitRegion,
  } = useRegionInspector();

  if (!activePage) {
    return (
      <InspectorEmptyState
        icon={<SettingsIcon size={20} className="text-zinc-600" />}
        title="Страница не открыта"
        description="Открой страницу или проект, чтобы редактировать регионы."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <InspectorHeader
        count={activePage.regions.length}
        activeView={activeView}
        onChange={setActiveView}
      />

      {activeView === 'pipeline' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ImageProcessingPanel />
          <ProjectSettingsPanel />
          <GlossaryPanel />
          <MemoryPanel />
        </div>
      ) : activeView === 'regions' ? (
        activePage.regions.length > 0 ? (
          <RegionListPanel
            regions={activePage.regions}
            selectedId={region?.id ?? null}
            pageId={activePage.id}
            fullHeight
          />
        ) : (
          <InspectorEmptyState
            icon={<LayersIcon size={20} className="text-zinc-600" />}
            title="Регионов пока нет"
            description="Нарисуй регион на холсте, и он появится в списке."
          />
        )
      ) : region ? (
        <RegionDetailsPanel
          pageId={activePage.id}
          region={region}
          update={update}
          onDuplicate={duplicateRegion}
          onSplit={splitRegion}
          onDelete={deleteRegion}
          onRerunOcr={rerunOcr}
        />
      ) : (
        <InspectorEmptyState
          icon={<Crosshair size={20} className="text-zinc-600" />}
          title="Регион не выбран"
          description="Кликни по региону на холсте или открой список регионов."
          action={
            activePage.regions.length > 0 ? (
              <button
                onClick={() => setActiveView('regions')}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                Открыть список регионов
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}
