"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Selected Images</CardTitle>
        <Button size="sm" variant="ghost" onClick={onAddClick}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {images.length > 0 ? (
          <div className="space-y-3">
            {images.map((image, index) => {
              const color = getImageColor(index);
              const label = getImageLabel(index);

              return (
                <div
                  key={image.id}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border-2 p-2 transition-all",
                    color.border,
                    color.bg
                  )}
                >
                  {/* Large color-coded label */}
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                      color.dot,
                      "text-white"
                    )}
                  >
                    {label}
                  </div>

                  {/* Image thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={getThumbnailUrl(image.storage_path)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>

                  {/* Image info */}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-medium truncate", color.text)}>
                      {image.source_ref || `Image ${index + 1}`}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {image.width}×{image.height} • {image.format}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveImage(image.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] opacity-0 transition-all hover:bg-red-600 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              );
            })}

            {/* Add more button */}
            <button
              onClick={onAddClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/[0.12] py-3 text-sm text-gray-600 transition-colors hover:border-black/[0.22] hover:text-gray-800"
            >
              <Plus className="h-4 w-4" />
              Add more images
            </button>
          </div>
        ) : (
          <button
            onClick={onAddClick}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/[0.12] py-8 text-gray-600 transition-colors hover:border-[#f2ff59] hover:text-gray-800"
          >
            <Plus className="h-8 w-8" />
            <span className="text-sm">Click to select images</span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}
