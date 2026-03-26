interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = '📄', title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 px-6 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-zinc-600">{description}</p>}
    </div>
  );
}
