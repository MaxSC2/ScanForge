import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface DatabaseIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface DatabaseIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const DatabaseIcon = forwardRef<DatabaseIconHandle, DatabaseIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);
    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return { startAnimation: () => controls.start('animate'), stopAnimation: () => controls.start('normal') };
    });
    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) { onMouseEnter?.(e); return; }
      controls.start('animate');
    }, [controls, onMouseEnter]);
    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) { onMouseLeave?.(e); return; }
      controls.start('normal');
    }, [controls, onMouseLeave]);
    return (
      <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
        <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <motion.ellipse animate={controls} cx="12" cy="5" rx="9" ry="3" variants={{ normal: { rx: 9, ry: 3 }, animate: { rx: [9, 10, 9], ry: [3, 2, 3], transition: { duration: 0.5 } } }} />
          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
          <motion.path animate={controls} d="M3 12a9 3 0 0 0 18 0" variants={{ normal: { opacity: 0.4 }, animate: { opacity: [0.4, 0.7, 0.4], transition: { duration: 0.5 } } }} />
        </svg>
      </div>
    );
  },
);
DatabaseIcon.displayName = 'DatabaseIcon';
export { DatabaseIcon };
