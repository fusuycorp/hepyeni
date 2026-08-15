import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ElementType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center transition-all",
        className
      )}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/80 border border-border/50 shadow-2xs">
          <Icon className="size-6" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
        {description && (
          <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
