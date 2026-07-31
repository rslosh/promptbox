import { cn } from "@/lib/utils";

type IconWellSize = "xs" | "sm" | "md" | "lg" | "xl";
type IconWellVariant = "default" | "accent" | "danger" | "success";

interface IconWellProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: IconWellSize;
  variant?: IconWellVariant;
}

const sizeClasses: Record<IconWellSize, string> = {
  xs: "h-6 w-6 rounded-pill",
  sm: "h-8 w-8 rounded-md",
  md: "h-10 w-10 rounded-lg",
  lg: "h-12 w-12 rounded-xl",
  xl: "h-14 w-14 rounded-xl",
};

const variantClasses: Record<IconWellVariant, string> = {
  default: "border bg-accent-faint text-secondary",
  accent: "border-transparent bg-accent text-on-accent",
  danger: "border-transparent bg-error/10 text-error",
  success: "border-transparent bg-[var(--status-success-halo)] text-success",
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
