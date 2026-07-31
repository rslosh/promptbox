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
  onInsertToken?: (text: string) => void;
}

export function LeftPanel({
  open,
  onToggle,
  images,
  components,
  onAddClick,
  onRemoveImage,
  onRemoveComponent,
  onInsertToken,
}: LeftPanelProps) {
  return (
    // h-full so the panel stretches to the parent flex container's height (enables scrolling)
    <div className="flex h-full shrink-0">
      {/* Collapsible content */}
      <div
        className={cn(
          "h-full overflow-hidden transition-all duration-300",
          open ? "w-[340px]" : "w-0"
        )}
      >
        <div className="flex h-full w-[340px] flex-col border-r border-hairline bg-surface">
          {/* Scrollable content area with bottom padding so floating bar doesn't cover last item */}
          <div className="flex-1 overflow-y-auto p-4 pb-52">
            <div className="space-y-6">
              <SelectedImages
                images={images}
                onAddClick={onAddClick}
                onRemoveImage={onRemoveImage}
                onInsertToken={onInsertToken}
              />
              <PromptComponents
                components={components}
                onRemoveComponent={onRemoveComponent}
                onInsertToken={onInsertToken}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toggle tab */}
      <button
        onClick={onToggle}
        title={open ? "Collapse panel" : "Expand panel"}
        className="mt-4 flex h-14 w-6 shrink-0 flex-col items-center justify-center gap-1 rounded-r-xl border border-l-0 border-hairline bg-surface shadow-md transition-colors hover:bg-hover-soft"
      >
        {open ? (
          <ChevronLeft className="h-4 w-4 text-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-tertiary" />
        )}
        <div className="flex flex-col gap-[3px]">
          <div className="h-[3px] w-2.5 rounded-full bg-accent-soft" />
          <div className="h-[3px] w-2.5 rounded-full bg-accent-soft" />
          <div className="h-[3px] w-2.5 rounded-full bg-accent-soft" />
        </div>
      </button>
    </div>
  );
}
