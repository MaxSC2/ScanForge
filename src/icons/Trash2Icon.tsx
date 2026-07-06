import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface Trash2IconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface Trash2IconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const Trash2Icon = forwardRef<Trash2IconHandle, Trash2IconProps>(
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
          <motion.path animate={controls} d="M3 6h18" variants={{ normal: { y: 0 }, animate: { y: [-1, 0], transition: { duration: 0.2 } } }} />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <motion.line animate={controls} variants={{ normal: { opacity: 1 }, animate: { opacity: [0, 1], transition: { delay: 0.2 } } }} x1="10" x2="10" y1="11" y2="17" />
          <motion.line animate={controls} variants={{ normal: { opacity: 1 }, animate: { opacity: [0, 1], transition: { delay: 0.25 } } }} x1="14" x2="14" y1="11" y2="17" />
        </svg>
      </div>
    );
  },
);
Trash2Icon.displayName = 'Trash2Icon';
export { Trash2Icon };
