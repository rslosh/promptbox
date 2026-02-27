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
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2ff59]/60 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-gray-900 text-white hover:bg-gray-800": variant === "default",
            "bg-black/[0.06] text-gray-700 hover:bg-black/[0.1]": variant === "secondary",
            "text-gray-600 hover:bg-black/[0.05] hover:text-gray-900": variant === "ghost",
            "border border-black/[0.12] bg-transparent text-gray-700 hover:bg-black/[0.04] hover:text-gray-900": variant === "outline",
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
