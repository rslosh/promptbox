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
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-black/[0.08] bg-white/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="space-y-4">
            {/* Layout */}
            <div>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Layout
              </h4>
              <div className="space-y-0.5">
                {([
                  { value: "square" as const, icon: Square, label: "Square crop" },
                  { value: "full" as const, icon: LayoutGrid, label: "Full image" },
                ]).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => onLayoutChange(value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      layout === value
                        ? "bg-[#f2ff59]/40 text-gray-900 font-medium"
                        : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        layout === value ? "border-gray-900 bg-gray-900" : "border-gray-300"
                      )}
                    >
                      {layout === value && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Size */}
            <div>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Grid size
              </h4>
              <div className="space-y-0.5">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => onImageSizeChange(size)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm capitalize transition-colors",
                      imageSize === size
                        ? "bg-[#f2ff59]/40 text-gray-900 font-medium"
                        : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        imageSize === size ? "border-gray-900 bg-gray-900" : "border-gray-300"
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
