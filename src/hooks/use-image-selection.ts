"use client";

import { useState } from "react";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";

export interface SelectableImage extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

/**
 * Shared multi-select state for gallery grids. Keeps full image objects in a
 * map so selections survive filter changes that remove images from the list.
 */
export function useImageSelection(images: SelectableImage[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedImageMap, setSelectedImageMap] = useState<Map<string, SelectableImage>>(
    new Map()
  );

  function handleSelectionChange(newIds: string[]) {
    const addedId = newIds.find((id) => !selectedIds.includes(id));
    const removedId = selectedIds.find((id) => !newIds.includes(id));

    setSelectedImageMap((prev) => {
      const next = new Map(prev);
      if (addedId) {
        const img = images.find((i) => i.id === addedId);
        if (img) next.set(addedId, img);
      }
      if (removedId) next.delete(removedId);
      return next;
    });
    setSelectedIds(newIds);
  }

  function deselect(id: string) {
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    setSelectedImageMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function clear() {
    setSelectedIds([]);
    setSelectedImageMap(new Map());
  }

  return {
    selectedIds,
    selectedImages: Array.from(selectedImageMap.values()),
    handleSelectionChange,
    deselect,
    clear,
  };
}
