import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface LockIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface LockIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const LockIcon = forwardRef<LockIconHandle, LockIconProps>(
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
          <motion.path animate={controls} d="M8 11V7a4 4 0 0 1 8 0v4" variants={{ normal: { d: 'M8 11V7a4 4 0 0 1 8 0v4' }, animate: { d: ['M8 11V7a4 4 0 0 1 8 0v4', 'M8 11V5a4 4 0 0 1 8 0v6', 'M8 11V7a4 4 0 0 1 8 0v4'], transition: { duration: 0.5 } } }} />
          <rect height="8" rx="2" width="14" x="5" y="11" />
          <circle cx="12" cy="16" r="1" />
          <path d="M12 17v2" />
        </svg>
      </div>
    );
  },
);
LockIcon.displayName = 'LockIcon';
export { LockIcon };
