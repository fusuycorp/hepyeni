import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-xs text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
