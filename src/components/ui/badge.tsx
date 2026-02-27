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
          "bg-[#f2ff59]/20 text-[#f2ff59] border border-[#f2ff59]/30": variant === "default",
          "bg-white/[0.1] text-white/70 border border-white/[0.1]": variant === "secondary",
          "border border-white/[0.2] text-white/60": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
