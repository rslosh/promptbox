"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/supabase/client";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";
import { Plus, X } from "lucide-react";

interface ImageWithPrompt extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

interface SelectedImagesProps {
  images: ImageWithPrompt[];
  onAddClick: () => void;
  onRemoveImage: (id: string) => void;
}

export function SelectedImages({
  images,
  onAddClick,
  onRemoveImage,
}: SelectedImagesProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Selected Images
        </p>
        <Button size="sm" variant="ghost" onClick={onAddClick} className="h-6 w-6 p-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {images.length > 0 ? (
        <div className="space-y-2">
          {images.map((image, index) => {
            const color = getImageColor(index);
            const label = getImageLabel(index);

            return (
              <div
                key={image.id}
                className="group relative flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-all hover:border-gray-200"
              >
                {/* Left accent + label */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: color.hex }}
                >
                  {label}
                </div>

                {/* Thumbnail */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    src={getThumbnailUrl(image.storage_path)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-700">
                    {image.source_ref || `Image ${index + 1}`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {image.width}×{image.height} · {image.format}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => onRemoveImage(image.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            );
          })}

          <button
            onClick={onAddClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-xs text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Add more images
          </button>
        </div>
      ) : (
        <button
          onClick={onAddClick}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-gray-400 transition-colors hover:border-[#f2ff59] hover:text-gray-600"
        >
          <Plus className="h-6 w-6" />
          <span className="text-xs">Click to select images</span>
        </button>
      )}
    </div>
  );
}
