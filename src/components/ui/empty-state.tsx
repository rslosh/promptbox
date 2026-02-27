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

/** Centered empty / zero-state layout: icon well + title + description + optional action */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-24 text-center", className)}>
      <IconWell size="xl" className="mb-4">
        <Icon className="h-6 w-6" />
      </IconWell>

      <p className="text-sm font-medium text-gray-600">{title}</p>

      {description && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-600">{description}</p>
      )}

      {action && (
        action.href ? (
          <a
            href={action.href}
            className="mt-5 flex items-center gap-2 rounded-lg border border-black/[0.1] bg-black/[0.04] px-4 py-2 text-sm text-gray-600 transition-colors hover:border-black/[0.16] hover:bg-black/[0.07] hover:text-gray-900"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-5 flex items-center gap-2 rounded-lg border border-black/[0.1] bg-black/[0.04] px-4 py-2 text-sm text-gray-600 transition-colors hover:border-black/[0.16] hover:bg-black/[0.07] hover:text-gray-900"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
