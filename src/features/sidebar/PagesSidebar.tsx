import { useEffect, useState } from 'react';
import { AgentChat } from '../../components/AgentChat';
import { JobsPanel } from './JobsPanel';
import { PagesPanel } from './PagesPanel';
import { ProjectLibrary } from './ProjectLibrary';
import { SidebarTabs, type SidebarView } from './SidebarTabs';
import { useProjectLibraryStore } from '../../stores/useProjectLibraryStore';

export function PagesSidebar() {
  const [activeView, setActiveView] = useState<SidebarView>('pages');
  const refreshProjects = useProjectLibraryStore((state) => state.refresh);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarTabs activeView={activeView} onChange={setActiveView} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeView === 'projects' ? (
          <div className="h-full overflow-y-auto">
            <ProjectLibrary />
          </div>
        ) : null}

        {activeView === 'jobs' ? (
          <div className="h-full overflow-y-auto">
            <JobsPanel />
          </div>
        ) : null}

        {activeView === 'pages' ? <PagesPanel /> : null}

        {activeView === 'agent' ? <AgentChat /> : null}
      </div>
    </div>
  );
}
