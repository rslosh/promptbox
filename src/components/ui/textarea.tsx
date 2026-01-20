"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white",
          "placeholder:text-white/40",
          "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
