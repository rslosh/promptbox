import { cn } from "@/lib/utils";

type ChipVariant = "default" | "accent" | "success" | "danger" | "warning";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const variantClasses: Record<ChipVariant, string> = {
  default: "border-white/[0.12] bg-white/[0.08] text-white/55",
  accent:  "border-[#f2ff59]/50 bg-[#f2ff59]/15 text-[#f2ff59]",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  danger:  "border-red-500/30 bg-red-500/10 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
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
