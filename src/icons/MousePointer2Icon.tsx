import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface MousePointer2IconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface MousePointer2IconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const MousePointer2Icon = forwardRef<MousePointer2IconHandle, MousePointer2IconProps>(
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
        <motion.svg animate={controls} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, 2, 0], y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } } }} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <path d="M17.987 18.34a1 1 0 0 1-.45 1.12l-2.92 1.57a1 1 0 0 1-1.41-.45L8.7 11.75a1 1 0 0 1 .25-1.2l6.7-5.98a1 1 0 0 1 1.46.15l3.47 4.63a1 1 0 0 1-.14 1.32l-2.47 2.22Z" />
          <path d="m13.64 14.46 4.25 4.25" />
        </motion.svg>
      </div>
    );
  },
);
MousePointer2Icon.displayName = 'MousePointer2Icon';
export { MousePointer2Icon };
