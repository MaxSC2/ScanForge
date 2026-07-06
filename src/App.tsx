import { Layout } from './components/Layout';
import { Toolbar } from './features/toolbar/Toolbar';
import { PagesSidebar } from './features/sidebar/PagesSidebar';
import { EditorCanvas } from './features/canvas/EditorCanvas';
import { RegionInspector } from './features/inspector/RegionInspector';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ToastContainer';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useLocalProjectPersistence } from './hooks/useLocalProjectPersistence';

export default function App() {
  useBeforeUnload();
  useKeyboardShortcuts();
  useLocalProjectPersistence();

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
