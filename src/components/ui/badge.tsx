import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium transition-colors duration-quick",
        {
          "bg-accent text-on-accent": variant === "default",
          "bg-accent-faint text-secondary border": variant === "secondary",
          "border border-strong text-secondary": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
