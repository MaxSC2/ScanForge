import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '../lib/utils';

export interface WorkflowIconHandle { startAnimation: () => void; stopAnimation: () => void; }
interface WorkflowIconProps extends HTMLAttributes<HTMLDivElement> { size?: number; }

const WorkflowIcon = forwardRef<WorkflowIconHandle, WorkflowIconProps>(
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
        <motion.svg animate={controls} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" variants={{ normal: { x: 0 }, animate: { x: [1, 0], transition: { duration: 0.3 } } }} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <rect height="6" rx="2" width="6" x="3" y="3" />
          <rect height="6" rx="2" width="6" x="15" y="3" />
          <rect height="6" rx="2" width="6" x="9" y="15" />
          <path d="M9 6h6" />
          <path d="M12 9v6" />
        </motion.svg>
      </div>
    );
  },
);
WorkflowIcon.displayName = 'WorkflowIcon';
export { WorkflowIcon };
