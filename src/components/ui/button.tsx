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
          "inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-quick ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:pointer-events-none disabled:opacity-40",
          {
            "rounded-pill bg-accent text-on-accent hover:bg-accent-hover": variant === "default",
            "gos-btn rounded-md text-primary hover:brightness-[1.02] active:brightness-[0.98]":
              variant === "secondary",
            "rounded-md text-secondary hover:bg-hover-soft hover:text-primary": variant === "ghost",
            "rounded-md border border-strong bg-transparent text-secondary hover:bg-hover-soft hover:text-primary":
              variant === "outline",
            "rounded-md bg-error text-white hover:opacity-90": variant === "destructive",
          },
          {
            "h-7 px-2.5 text-xs": size === "sm",
            "h-8 px-4 text-sm": size === "md",
            "h-9 px-5 text-sm": size === "lg",
            "h-8 w-8": size === "icon",
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
