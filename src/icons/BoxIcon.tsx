import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface BoxIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface BoxIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const BoxIcon = forwardRef<BoxIconHandle, BoxIconProps>(
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
        <motion.svg animate={controls} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" variants={{ normal: { rotateX: 0 }, animate: { rotateX: [0, 10, 0], transition: { duration: 0.5 } } }} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </motion.svg>
      </div>
    );
  },
);
BoxIcon.displayName = 'BoxIcon';
export { BoxIcon };
