import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface ZoomInIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface ZoomInIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const ZoomInIcon = forwardRef<ZoomInIconHandle, ZoomInIconProps>(
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
        <motion.svg animate={controls} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.15, 1], transition: { duration: 0.4 } } }} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" />
          <motion.path d="M11 8v6" variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.3, 1], transition: { duration: 0.3, delay: 0.1 } } }} />
          <motion.path d="M8 11h6" variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.3, 1], transition: { duration: 0.3, delay: 0.1 } } }} />
          <path d="m21 21-4.3-4.3" />
        </motion.svg>
      </div>
    );
  },
);
ZoomInIcon.displayName = 'ZoomInIcon';
export { ZoomInIcon };
