import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface CombineIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface CombineIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const CombineIcon = forwardRef<CombineIconHandle, CombineIconProps>(
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
        <motion.svg animate={controls} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" variants={{ normal: { x: 0 }, animate: { x: [-1, 0], transition: { duration: 0.3 } } }} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <rect height="12" rx="2" width="12" x="2" y="8" />
          <path d="M6 4v4" />
          <path d="M10 4v4" />
          <path d="M6 16v4" />
          <path d="M10 16v4" />
          <motion.g variants={{ normal: { x: 0, opacity: 1 }, animate: { x: [-2, 0], opacity: [0.5, 1], transition: { duration: 0.4 } } }}>
            <rect height="12" rx="2" width="12" x="10" y="4" />
            <path d="M14 2v4" />
            <path d="M18 2v4" />
          </motion.g>
        </motion.svg>
      </div>
    );
  },
);
CombineIcon.displayName = 'CombineIcon';
export { CombineIcon };
