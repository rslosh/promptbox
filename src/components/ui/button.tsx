"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2ff59]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#53544b]",
          "disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-[#f2ff59] text-[#1c1b18] hover:bg-[#f2ff59]/85": variant === "default",
            "bg-white/[0.1] text-white/80 hover:bg-white/[0.16]": variant === "secondary",
            "text-white/60 hover:bg-white/[0.08] hover:text-white/90": variant === "ghost",
            "border border-white/[0.15] bg-transparent text-white/70 hover:bg-white/[0.08] hover:text-white/90": variant === "outline",
            "bg-red-500 text-white hover:bg-red-600": variant === "destructive",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-9 px-4 text-sm": size === "md",
            "h-11 px-6 text-base": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
