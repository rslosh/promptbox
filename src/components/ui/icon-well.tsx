import { cn } from "@/lib/utils";

type IconWellSize = "xs" | "sm" | "md" | "lg" | "xl";
type IconWellVariant = "default" | "accent" | "danger" | "success";

interface IconWellProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: IconWellSize;
  variant?: IconWellVariant;
}

const sizeClasses: Record<IconWellSize, string> = {
  xs: "h-6 w-6 rounded-full",
  sm: "h-8 w-8 rounded-xl",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
  xl: "h-14 w-14 rounded-2xl",
};

const variantClasses: Record<IconWellVariant, string> = {
  default: "border border-white/10 bg-white/5 text-white/30",
  accent:  "border border-purple-500/30 bg-purple-500/10 text-purple-400",
  danger:  "border border-red-500/30 bg-red-500/10 text-red-400",
  success: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

/** Centered icon container used for empty states, section headers, and status indicators */
export function IconWell({ size = "md", variant = "default", className, ...props }: IconWellProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
