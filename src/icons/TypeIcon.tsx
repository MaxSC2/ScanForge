import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface TypeIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface TypeIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const VARIANTS: Variants = { normal: { pathLength: 1, opacity: 1 }, animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.4 } } };

const TypeIcon = forwardRef<TypeIconHandle, TypeIconProps>(
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
          <motion.path animate={controls} d="M4 7V4h16v3" variants={VARIANTS} />
          <motion.path animate={controls} custom={1} d="M9 20h6" variants={{ normal: { pathLength: 1, opacity: 1 }, animate: { pathLength: [0, 1], opacity: [0, 1], transition: { delay: 0.1, duration: 0.3 } } }} />
          <motion.path animate={controls} custom={2} d="M12 4v16" variants={{ normal: { pathLength: 1, opacity: 1 }, animate: { pathLength: [0, 1], opacity: [0, 1], transition: { delay: 0.2, duration: 0.3 } } }} />
        </svg>
      </div>
    );
  },
);
TypeIcon.displayName = 'TypeIcon';
export { TypeIcon };
