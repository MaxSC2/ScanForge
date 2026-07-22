import { Component, type ReactNode } from 'react';
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

let sfCompStack = '';
class ErrorBoundary extends Component<{ children: ReactNode }> {
  state = { error: null as Error | null, compStack: '' };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    sfCompStack = info.componentStack || '';
    this.setState({ compStack: sfCompStack });
    const log = JSON.parse(localStorage.getItem('sf_err') || '[]');
    log.push({ msg: error.message, stack: error.stack, componentStack: info.componentStack });
    localStorage.setItem('sf_err', JSON.stringify(log));
  }
  render() {
    if (this.state.error) return <div style={{ padding: 20, color: '#f00', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>{this.state.error.stack}{'\n\n'}Component stack:{'\n'}{this.state.compStack}</div>;
    return this.props.children;
  }
}

export default function App() { return <ErrorBoundary><AppInner /></ErrorBoundary>; }

function AppInner() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
