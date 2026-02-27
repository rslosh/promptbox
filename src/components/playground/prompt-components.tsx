"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { PromptComponent } from "@/lib/supabase/types";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

interface PromptComponentsProps {
  components: PromptComponent[];
  onRemoveComponent: (id: string) => void;
  onInsertToken?: (text: string) => void;
}

function ImageGroup({
  imageIndex,
  components,
  onInsertToken,
}: {
  imageIndex: number;
  components: PromptComponent[];
  onInsertToken?: (text: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const color = getImageColor(imageIndex);
  const label = getImageLabel(imageIndex);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Group header — click to collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
        <div
          className="flex h-5 w-10 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
          style={{ backgroundColor: color.hex }}
        >
          {label}
        </div>
        <span className="text-[10px] font-medium text-gray-500">
          {components.length} field{components.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Fields */}
      {open && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {components.map((component) => (
            <button
              key={component.id}
              onClick={() => onInsertToken?.(component.value)}
              disabled={!onInsertToken}
              title={onInsertToken ? `Insert: ${component.value}` : undefined}
              className={cn(
                "group flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                onInsertToken
                  ? "cursor-pointer hover:bg-[#f2ff59]/20"
                  : "cursor-default"
              )}
            >
              {/* Field type badge */}
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white"
                style={{ backgroundColor: color.hex }}
              >
                {component.type}
              </span>

              {/* Value */}
              <p className="flex-1 text-[10px] leading-relaxed text-gray-600 line-clamp-3">
                {component.value}
              </p>

              {/* Insert affordance */}
              {onInsertToken && (
                <Plus className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PromptComponents({
  components,
  onRemoveComponent: _onRemoveComponent,
  onInsertToken,
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
          Image Fields
        </p>
        {components.length > 0 && (
          <span className="text-[10px] text-gray-400">{components.length} fields</span>
        )}
      </div>

      {components.length > 0 ? (
        <div className="space-y-2">
          {imageIndices.map((imageIndex) => (
            <ImageGroup
              key={imageIndex}
              imageIndex={imageIndex}
              components={groupedComponents[imageIndex]}
              onInsertToken={onInsertToken}
            />
          ))}
          {onInsertToken && (
            <p className="px-1 text-[10px] text-gray-300">
              Click any field to insert it at the cursor
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-xs text-gray-400">Select images to see their fields</p>
          <p className="mt-1 text-[10px] text-gray-300">
            Click fields to insert them into your prompt
          </p>
        </div>
      )}
    </div>
  );
}
