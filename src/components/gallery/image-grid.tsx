"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Eye, Copy, Trash2 } from "lucide-react";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";
import { getThumbnailUrl, getImageUrl } from "@/lib/supabase/client";
import { copyToClipboard, formatRelativeTime } from "@/lib/utils";
import type { LayoutType, ImageSize } from "./view-options";

interface ImageWithDetails extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

interface ImageGridProps {
  images: ImageWithDetails[];
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onDelete?: (id: string) => void;
  layout?: LayoutType;
  imageSize?: ImageSize;
}

const sizeClasses = {
  small: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  large: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

export function ImageGrid({
  images,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onDelete,
  layout = "square",
  imageSize = "medium",
}: ImageGridProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (!onSelectionChange) return;

    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];

    onSelectionChange(newSelection);
  };

  const handleCopyPrompt = async (prompt: Prompt, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await copyToClipboard(prompt.natural_prompt);
    if (success) {
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      const response = await fetch(`/api/images/${id}`, { method: "DELETE" });
      if (response.ok && onDelete) onDelete(id);
    } catch (error) {
      console.error("Delete error:", error);
    }
    setDeletingId(null);
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleImageError = (imageId: string) => {
    setFailedImages((prev) => new Set(prev).add(imageId));
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/3">
          <Eye className="h-6 w-6 text-white/20" />
        </div>
        <p className="text-sm font-medium text-white/50">No images found</p>
        <p className="mt-1 text-xs text-white/25">
          Try adjusting your filters or upload new images.
        </p>
        <Link href="/upload" onClick={(e) => e.stopPropagation()}>
          <button className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-white">
            Upload images
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4", sizeClasses[imageSize])}>
      {images.map((image) => {
        const isSelected = selectedIds.includes(image.id);
        const firstPrompt = image.prompts?.[0];
        const isDeleting = deletingId === image.id;
        const isConfirmingDelete = confirmDeleteId === image.id;
        
        // Use thumbnail if available, fallback to original image
        const useFallback = failedImages.has(image.id);
        const imageUrl = useFallback 
          ? getImageUrl(image.storage_path)
          : getThumbnailUrl(image.storage_path);

        return (
          <div
            key={image.id}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-white/5",
              selectable && "cursor-pointer",
              isSelected
                ? "border-purple-500 ring-2 ring-purple-500/50"
                : "border-white/10 hover:border-white/20",
              isDeleting && "opacity-50 pointer-events-none"
            )}
            onClick={() => selectable && handleSelect(image.id)}
          >
            {/* Image container - always 1:1 aspect ratio */}
            <div className="relative w-full aspect-square">
              <Image
                src={imageUrl}
                alt=""
                fill
                className={cn(
                  // Square layout: fill the container, crop if needed
                  // Full layout: contain within container, show native aspect ratio
                  layout === "square" ? "object-cover" : "object-contain"
                )}
                sizes={
                  imageSize === "small"
                    ? "(max-width: 640px) 25vw, (max-width: 768px) 20vw, 12vw"
                    : imageSize === "medium"
                    ? "(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                    : "(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                }
                onError={() => handleImageError(image.id)}
              />

              {/* Selection checkbox */}
              {selectable && (
                <div
                  className={cn(
                    "absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-purple-500 bg-purple-500"
                      : "border-white/50 bg-black/50 opacity-0 group-hover:opacity-100"
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
              )}

              {/* Delete button - top right */}
              <button
                onClick={(e) => handleDeleteClick(image.id, e)}
                className={cn(
                  "absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-all hover:bg-red-500/80 hover:text-white",
                  isConfirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Trash2 className="h-3 w-3" />
              </button>

              {/* Inline delete confirm overlay */}
              {isConfirmingDelete && (
                <div
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/75 backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-medium text-white">Delete image?</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleDeleteCancel}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/20"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => handleDeleteConfirm(image.id, e)}
                      className="rounded-lg border border-red-500/40 bg-red-500/25 px-3 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div className="p-3">
                  {/* Tags */}
                  {image.tags && image.tags.length > 0 && imageSize !== "small" && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {image.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-[10px]">
                          {tag.tag}
                        </Badge>
                      ))}
                      {image.tags.length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{image.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href={`/image/${image.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="secondary" className="h-7 text-xs">
                        <Eye className="mr-1 h-3 w-3" />
                        {imageSize === "small" ? "" : "View"}
                      </Button>
                    </Link>
                    {firstPrompt && imageSize !== "small" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={(e) => handleCopyPrompt(firstPrompt, e)}
                      >
                        {copiedId === firstPrompt.id ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <Copy className="mr-1 h-3 w-3" />
                        )}
                        Copy
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - hide on small size */}
            {imageSize !== "small" && (
              <div className="p-2">
                <p className="text-xs text-white/40">
                  {formatRelativeTime(image.created_at)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
