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
        <div>
          <div className="grid grid-cols-3 gap-2">
            {images.map((image, index) => {
              const color = getImageColor(index);
              const label = getImageLabel(index);

              return (
                <div
                  key={image.id}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100"
                >
                  <Image
                    src={getThumbnailUrl(image.storage_path)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="100px"
                  />

                  {/* Label badge */}
                  <div
                    className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: color.hex }}
                  >
                    {label}
                  </div>

                  {/* Remove on hover */}
                  <button
                    onClick={() => onRemoveImage(image.id)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              );
            })}

            {/* Add more — same grid cell size */}
            <button
              onClick={onAddClick}
              className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
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
