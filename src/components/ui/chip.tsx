import { cn } from "@/lib/utils";

type ChipVariant = "default" | "accent" | "success" | "danger" | "warning";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const variantClasses: Record<ChipVariant, string> = {
  default: "border-black/[0.1] bg-black/[0.04] text-gray-600",
  accent:  "border-[#f2ff59] bg-[#f2ff59]/40 text-gray-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger:  "border-red-200 bg-red-50 text-red-600",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
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
