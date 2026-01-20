"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutGrid, Square, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export type LayoutType = "square" | "full";
export type ImageSize = "small" | "medium" | "large";

interface ViewOptionsProps {
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
}

export function ViewOptions({
  layout,
  onLayoutChange,
  imageSize,
  onImageSizeChange,
}: ViewOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <LayoutGrid className="h-4 w-4" />
        View
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-black/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="space-y-4">
            {/* Layout */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
                Layout
              </h4>
              <div className="space-y-1">
                <button
                  onClick={() => onLayoutChange("square")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    layout === "square"
                      ? "bg-purple-600/20 text-purple-300"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2",
                      layout === "square" ? "border-purple-500 bg-purple-500" : "border-white/30"
                    )}
                  >
                    {layout === "square" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <Square className="h-4 w-4" />
                  Square
                </button>
                <button
                  onClick={() => onLayoutChange("full")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    layout === "full"
                      ? "bg-purple-600/20 text-purple-300"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2",
                      layout === "full" ? "border-purple-500 bg-purple-500" : "border-white/30"
                    )}
                  >
                    {layout === "full" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <LayoutGrid className="h-4 w-4" />
                  Full
                </button>
              </div>
            </div>

            {/* Image Size */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
                Image Size
              </h4>
              <div className="space-y-1">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => onImageSizeChange(size)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm capitalize transition-colors",
                      imageSize === size
                        ? "bg-purple-600/20 text-purple-300"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border-2",
                        imageSize === size ? "border-purple-500 bg-purple-500" : "border-white/30"
                      )}
                    >
                      {imageSize === size && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
