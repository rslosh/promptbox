import { cn } from "@/lib/utils";

type ChipVariant = "default" | "accent" | "success" | "danger" | "warning";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const variantClasses: Record<ChipVariant, string> = {
  default: "border-white/10 bg-white/5 text-white/50",
  accent:  "border-purple-500/30 bg-purple-500/10 text-purple-300",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  danger:  "border-red-500/25 bg-red-500/10 text-red-400",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-400",
};

/** Rounded pill badge — used for status indicators, tags, and platform labels */
export function Chip({ variant = "default", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
