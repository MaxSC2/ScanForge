import { useMediaQuery } from './hooks/useMediaQuery';
import { Layout } from './components/Layout';
import { MobileShell } from './components/MobileShell';
import { MobileToolbar } from './features/toolbar/MobileToolbar';
import { Toolbar } from './features/toolbar/Toolbar';
import { PagesSidebar } from './features/sidebar/PagesSidebar';
import { EditorCanvas } from './features/canvas/EditorCanvas';
import { RegionInspector } from './features/inspector/RegionInspector';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ToastContainer';
import { SettingsDialog } from './components/SettingsDialog';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useLocalProjectPersistence } from './hooks/useLocalProjectPersistence';
import { useFontLoader } from './hooks/useFontLoader';
import { useState } from 'react';

export default function App() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pagesSheet, setPagesSheet] = useState(false);
  const [inspectorSheet, setInspectorSheet] = useState(false);

  useBeforeUnload();
  useKeyboardShortcuts();
  useLocalProjectPersistence();
  useFontLoader();

  if (isMobile) {
    return (
      <>
        <MobileShell
          toolbar={
            <MobileToolbar
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenPages={() => setPagesSheet(true)}
              onOpenInspector={() => setInspectorSheet(true)}
            />
          }
          sidebar={<PagesSidebar />}
          canvas={<EditorCanvas />}
          inspector={<RegionInspector />}
          statusBar={<StatusBar />}
        />
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <Layout
        toolbar={<Toolbar />}
        sidebar={<PagesSidebar />}
        canvas={<EditorCanvas />}
        inspector={<RegionInspector />}
        statusBar={<StatusBar />}
      />
      <ToastContainer />
    </>
  );
}
