import { Layout } from './components/Layout';
import { Toolbar } from './features/toolbar/Toolbar';
import { PagesSidebar } from './features/sidebar/PagesSidebar';
import { EditorCanvas } from './features/canvas/EditorCanvas';
import { RegionInspector } from './features/inspector/RegionInspector';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ToastContainer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();

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
