"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Eye, Copy, Trash2, Braces } from "lucide-react";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";
import { EmptyState } from "@/components/ui/empty-state";
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

  const handleCopySceneJson = async (prompt: Prompt, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await copyToClipboard(JSON.stringify(prompt.scene_prompt, null, 2));
    if (success) {
      setCopiedId(`scene-${prompt.id}`);
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
      <EmptyState
        icon={Eye}
        title="No images found"
        description="Try adjusting your filters or upload new images."
        action={{ label: "Upload images", href: "/upload" }}
      />
    );
  }

  return (
    <div className={cn("grid gap-3", sizeClasses[imageSize])}>
      {images.map((image) => {
        const isSelected = selectedIds.includes(image.id);
        const firstPrompt = image.prompts?.[0];
        const sceneJson = firstPrompt?.scene_prompt as Record<string, unknown> | null | undefined;
        const hasScene = !!sceneJson && Object.keys(sceneJson).length > 0;
        const isDeleting = deletingId === image.id;
        const isConfirmingDelete = confirmDeleteId === image.id;

        const useFallback = failedImages.has(image.id);
        const imageUrl = useFallback
          ? getImageUrl(image.storage_path)
          : getThumbnailUrl(image.storage_path);

        return (
          <div
            key={image.id}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-black/[0.03]",
              selectable && "cursor-pointer",
              isSelected
                ? "border-gray-900 ring-2 ring-gray-900/20"
                : "border-black/[0.08] hover:border-black/[0.18]",
              isDeleting && "opacity-50 pointer-events-none"
            )}
            onClick={() => selectable && handleSelect(image.id)}
          >
            {/* Image container */}
            <div className="relative w-full aspect-square">
              <Image
                src={imageUrl}
                alt=""
                fill
                className={cn(
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
                    "absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-gray-900 bg-gray-900"
                      : "border-white/70 bg-black/30 opacity-0 group-hover:opacity-100"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
              )}

              {/* Delete button - top right */}
              <button
                onClick={(e) => handleDeleteClick(image.id, e)}
                className={cn(
                  "absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white/80 transition-all hover:bg-red-500 hover:text-white",
                  isConfirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>

              {/* Inline delete confirm overlay */}
              {isConfirmingDelete && (
                <div
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-medium text-white">Delete image?</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleDeleteCancel}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/20"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => handleDeleteConfirm(image.id, e)}
                      className="rounded-lg border border-red-400/40 bg-red-500/30 px-3 py-1 text-xs text-red-200 transition-colors hover:bg-red-500/50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div className="p-3">
                  {/* natural_prompt preview */}
                  {firstPrompt?.natural_prompt && imageSize !== "small" && (
                    <p className="mb-2 line-clamp-2 text-[10px] leading-relaxed text-white/85">
                      {firstPrompt.natural_prompt}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/image/${image.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="secondary" className="h-7 text-xs bg-white/15 text-white hover:bg-white/25 border-0" title="View image details">
                        <Eye className={cn("h-3 w-3", imageSize !== "small" && "mr-1")} />
                        {imageSize === "small" ? "" : "View"}
                      </Button>
                    </Link>
                    {firstPrompt && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs bg-white/15 text-white hover:bg-white/25 border-0"
                        onClick={(e) => handleCopyPrompt(firstPrompt, e)}
                        title="Copy natural-language prompt"
                      >
                        {copiedId === firstPrompt.id ? (
                          <Check className={cn("h-3 w-3", imageSize !== "small" && "mr-1")} />
                        ) : (
                          <Copy className={cn("h-3 w-3", imageSize !== "small" && "mr-1")} />
                        )}
                        {imageSize === "small" ? "" : "Copy"}
                      </Button>
                    )}
                    {firstPrompt && hasScene && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs bg-white/15 text-white hover:bg-white/25 border-0"
                        onClick={(e) => handleCopySceneJson(firstPrompt, e)}
                        title="Copy Ideogram (scene composition) JSON"
                      >
                        {copiedId === `scene-${firstPrompt.id}` ? (
                          <Check className={cn("h-3 w-3", imageSize !== "small" && "mr-1")} />
                        ) : (
                          <Braces className={cn("h-3 w-3", imageSize !== "small" && "mr-1")} />
                        )}
                        {imageSize === "small" ? "" : "Ideogram"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - hide on small size */}
            {imageSize !== "small" && (
              <div className="px-2.5 py-2">
                <p className="text-[11px] text-gray-600">
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
