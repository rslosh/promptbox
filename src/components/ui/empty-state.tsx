import { cn } from "@/lib/utils";
import { IconWell } from "./icon-well";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

const actionClasses =
  "gos-btn mt-5 flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium text-secondary transition-all duration-quick hover:text-primary";

/** Centered empty / zero-state layout: icon well + title + description + optional action */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-24 text-center", className)}>
      <IconWell size="xl" className="mb-4">
        <Icon className="h-6 w-6" />
      </IconWell>

      <p className="text-md font-medium text-primary">{title}</p>

      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-secondary">{description}</p>
      )}

      {action &&
        (action.href ? (
          <a href={action.href} className={actionClasses}>
            {action.label}
          </a>
        ) : (
          <button onClick={action.onClick} className={actionClasses}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
