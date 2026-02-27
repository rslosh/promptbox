"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SelectedImages } from "./selected-images";
import { PromptComponents } from "./prompt-components";
import type { ImageAsset, AssetTag, Prompt, PromptComponent } from "@/lib/supabase/types";

interface ImageWithPrompt extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

interface LeftPanelProps {
  open: boolean;
  onToggle: () => void;
  images: ImageWithPrompt[];
  components: PromptComponent[];
  onAddClick: () => void;
  onRemoveImage: (id: string) => void;
  onRemoveComponent: (id: string) => void;
}

export function LeftPanel({
  open,
  onToggle,
  images,
  components,
  onAddClick,
  onRemoveImage,
  onRemoveComponent,
}: LeftPanelProps) {
  return (
    <div className="flex shrink-0 items-start">
      {/* Collapsible content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          open ? "w-[280px]" : "w-0"
        )}
      >
        <div className="flex h-full w-[280px] flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white p-4 pb-48">
          <SelectedImages
            images={images}
            onAddClick={onAddClick}
            onRemoveImage={onRemoveImage}
          />
          <PromptComponents
            components={components}
            onRemoveComponent={onRemoveComponent}
          />
        </div>
      </div>

      {/* Toggle tab — flex sibling, always visible at the canvas edge */}
      <button
        onClick={onToggle}
        title={open ? "Collapse panel" : "Expand panel"}
        className="mt-4 flex h-14 w-6 shrink-0 flex-col items-center justify-center gap-1 rounded-r-xl border border-l-0 border-gray-200 bg-white shadow-md transition-colors hover:bg-gray-50"
      >
        {open ? (
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
        <div className="flex flex-col gap-[3px]">
          <div className="h-[3px] w-2.5 rounded-full bg-gray-300" />
          <div className="h-[3px] w-2.5 rounded-full bg-gray-300" />
          <div className="h-[3px] w-2.5 rounded-full bg-gray-300" />
        </div>
      </button>
    </div>
  );
}
