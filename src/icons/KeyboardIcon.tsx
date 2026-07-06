import { AnimatePresence, motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '../lib/utils';

export interface KeyboardIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface KeyboardIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const KEYS = [
  { id: 'k1', d: 'M10 8h.01' }, { id: 'k2', d: 'M12 12h.01' }, { id: 'k3', d: 'M14 8h.01' },
  { id: 'k4', d: 'M16 12h.01' }, { id: 'k5', d: 'M18 8h.01' }, { id: 'k6', d: 'M6 8h.01' },
  { id: 'k7', d: 'M7 16h10' }, { id: 'k8', d: 'M8 12h.01' },
];

const KeyboardIcon = forwardRef<KeyboardIconHandle, KeyboardIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return { startAnimation: () => setIsHovered(true), stopAnimation: () => setIsHovered(false) };
    });
    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) { onMouseEnter?.(e); return; }
      setIsHovered(true);
    }, [onMouseEnter]);
    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) { onMouseLeave?.(e); return; }
      setIsHovered(false);
    }, [onMouseLeave]);

    useEffect(() => {
      const animate = async () => {
        if (isHovered) {
          await controls.start((i: number) => ({
            opacity: [1, 0.2, 1],
            transition: { duration: 1.5, times: [0, 0.5, 1], delay: i * 0.2 * Math.random(), repeat: 1, repeatType: 'reverse' },
          }));
        } else { controls.stop(); controls.set({ opacity: 1 }); }
      };
      animate();
    }, [isHovered, controls]);

    return (
      <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
        <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <rect height="16" rx="2" width="20" x="2" y="4" />
          <AnimatePresence>
            {KEYS.map((k, i) => (
              <motion.path animate={controls} custom={i} d={k.d} initial={{ opacity: 1 }} key={k.id} />
            ))}
          </AnimatePresence>
        </svg>
      </div>
    );
  },
);
KeyboardIcon.displayName = 'KeyboardIcon';
export { KeyboardIcon };
