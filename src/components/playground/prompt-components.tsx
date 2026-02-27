"use client";

import { cn } from "@/lib/utils";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { PromptComponent } from "@/lib/supabase/types";
import { X } from "lucide-react";

interface PromptComponentsProps {
  components: PromptComponent[];
  onRemoveComponent: (id: string) => void;
}

export function PromptComponents({
  components,
  onRemoveComponent,
}: PromptComponentsProps) {
  const groupedComponents = components.reduce(
    (acc, component) => {
      const key = component.imageIndex;
      if (!acc[key]) acc[key] = [];
      acc[key].push(component);
      return acc;
    },
    {} as Record<number, PromptComponent[]>
  );

  const imageIndices = Object.keys(groupedComponents)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Prompt Components
        </p>
        {components.length > 0 && (
          <span className="text-[10px] text-gray-400">{components.length} fields</span>
        )}
      </div>

      {components.length > 0 ? (
        <div className="space-y-3">
          {imageIndices.map((imageIndex) => {
            const color = getImageColor(imageIndex);
            const label = getImageLabel(imageIndex);
            const imageComponents = groupedComponents[imageIndex];

            return (
              <div key={imageIndex} className="space-y-1">
                {/* Image header */}
                <div className="flex items-center gap-2 px-1 py-1">
                  <div
                    className="flex h-5 w-10 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{ backgroundColor: color.hex }}
                  >
                    {label}
                  </div>
                  <span className="text-[10px] font-medium text-gray-500">
                    {imageComponents.length} component{imageComponents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Components */}
                <div className="space-y-1 pl-1">
                  {imageComponents.map((component) => (
                    <div
                      key={component.id}
                      className="group flex items-start gap-2 rounded-lg border border-gray-100 bg-white py-1.5 pl-2.5 pr-1.5 shadow-sm transition-colors hover:border-gray-200"
                    >
                      <span
                        className="mt-px shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white"
                        style={{ backgroundColor: color.hex }}
                      >
                        {component.type}
                      </span>
                      <p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-gray-600">
                        {component.value}
                      </p>
                      <button
                        onClick={() => onRemoveComponent(component.id)}
                        className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-xs text-gray-400">Select images to extract prompt components</p>
          <p className="mt-1 text-[10px] text-gray-300">
            Each image's JSON fields will appear here
          </p>
        </div>
      )}
    </div>
  );
}
