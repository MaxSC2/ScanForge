import { useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/useEditorStore';

/**
 * Attaches pinch-to-zoom + two-finger pan to a container element.
 * Emits zoomIn/zoomOut and stagePosition changes via useEditorStore.
 */
export function usePinchZoom(containerRef: React.RefObject<HTMLElement | null>) {
  const lastPinchDist = useRef(0);
  const lastCenter = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastPinchDist.current = 0;
        return;
      }

      e.preventDefault();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;

      if (lastPinchDist.current > 0) {
        const scale = dist / lastPinchDist.current;
        const store = useEditorStore.getState();

        if (scale > 1.05) {
          store.zoomIn();
        } else if (scale < 0.95) {
          store.zoomOut();
        }

        // Two-finger pan
        const panDx = cx - lastCenter.current.x;
        const panDy = cy - lastCenter.current.y;
        if (Math.abs(panDx) > 2 || Math.abs(panDy) > 2) {
          useEditorStore.setState({
            stagePosition: {
              x: store.stagePosition.x + panDx,
              y: store.stagePosition.y + panDy,
            },
          });
        }
      }

      lastPinchDist.current = dist;
      lastCenter.current = { x: cx, y: cy };
    };

    const onTouchEnd = () => {
      lastPinchDist.current = 0;
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef]);
}
