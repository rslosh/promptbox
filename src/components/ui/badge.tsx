import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-purple-600/20 text-purple-300": variant === "default",
          "bg-white/10 text-white/70": variant === "secondary",
          "border border-white/20 text-white/70": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
