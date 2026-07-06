import { useEffect } from 'react';
import { usePersistenceStore } from '../stores/usePersistenceStore';

export function useBeforeUnload() {
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const saveState = usePersistenceStore.getState().saveState;
      if (saveState === 'pending' || saveState === 'saving') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}
