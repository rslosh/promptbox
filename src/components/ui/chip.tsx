import { cn } from "@/lib/utils";

type ChipVariant = "default" | "accent" | "success" | "danger" | "warning";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const variantClasses: Record<ChipVariant, string> = {
  default: "border bg-accent-faint text-secondary",
  accent: "border-transparent bg-accent text-on-accent",
  success: "border-transparent bg-[var(--status-success-halo)] text-success",
  danger: "border-transparent bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] text-error",
  warning: "border-transparent bg-[color-mix(in_srgb,var(--icon-orange)_14%,transparent)] text-icon-orange",
};

/** Rounded pill badge — used for status indicators, tags, and platform labels */
export function Chip({ variant = "default", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
