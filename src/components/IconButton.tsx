import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tooltip?: string;
  variant?: 'default' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function IconButton({
  active = false,
  tooltip,
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...rest
}: IconButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-all duration-150 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    default: active
      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100',
    ghost: active
      ? 'bg-zinc-700/60 text-indigo-400'
      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
    danger:
      'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300',
  };

  const sizes = {
    sm: 'h-7 px-2 text-xs',
    md: 'h-8 px-2.5 text-sm',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      title={tooltip}
      {...rest}
    >
      {children}
    </button>
  );
}
