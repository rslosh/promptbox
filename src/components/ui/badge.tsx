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
          "bg-[#f2ff59]/40 text-gray-800 border border-[#f2ff59]": variant === "default",
          "bg-black/[0.06] text-gray-600 border border-black/[0.08]": variant === "secondary",
          "border border-black/[0.14] text-gray-600": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
