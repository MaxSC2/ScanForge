import { useToastStore, type ToastKind } from '../stores/useToastStore';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const kindStyles: Record<ToastKind, { bg: string; border: string; icon: React.ReactNode }> = {
  info: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-600',
    icon: <Info size={14} className="text-zinc-400" />,
  },
  success: {
    bg: 'bg-emerald-950/80',
    border: 'border-emerald-700/50',
    icon: <CheckCircle size={14} className="text-emerald-400" />,
  },
  warning: {
    bg: 'bg-amber-950/80',
    border: 'border-amber-700/50',
    icon: <AlertTriangle size={14} className="text-amber-400" />,
  },
  error: {
    bg: 'bg-red-950/80',
    border: 'border-red-700/50',
    icon: <XCircle size={14} className="text-red-400" />,
  },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const style = kindStyles[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm shadow-lg text-xs text-zinc-200 animate-in slide-in-from-right-4 ${style.bg} ${style.border}`}
          >
            {style.icon}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-zinc-500 hover:text-zinc-300 ml-2"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
