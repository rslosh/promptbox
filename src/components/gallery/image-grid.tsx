"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setGalleryNav } from "@/lib/gallery-nav";
import { cn } from "@/lib/utils";
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
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Publish the current grid order so the lightbox can arrow-key through it
  useEffect(() => {
    setGalleryNav(images.map((i) => i.id));
  }, [images]);

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
              "group relative cursor-pointer overflow-hidden rounded-xl border bg-hover-soft",
              isSelected
                ? "border-accent ring-2 ring-accent/20"
                : "border-hairline hover:border-strong",
              isDeleting && "opacity-50 pointer-events-none"
            )}
            onClick={() =>
              // Clicking the card opens the lightbox (intercepted /image route);
              // selection happens via the circle control, not the card body.
              router.push(`/image/${image.id}`, { scroll: false })
            }
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(image.id);
                  }}
                  aria-label={isSelected ? "Deselect image" : "Select image"}
                  className={cn(
                    "absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-accent bg-accent"
                      : "border-white/70 bg-black/30 opacity-0 group-hover:opacity-100"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-on-accent" />}
                </button>
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

                  {/* Actions — glass chips over imagery, deliberately not Button
                      (gos-btn's gradient surface is opaque and fights the overlay) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/image/${image.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-6 items-center rounded-md bg-white/15 px-2 text-xs font-medium text-white backdrop-blur-sm transition-colors duration-quick hover:bg-white/25"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      {imageSize === "small" ? "" : "View"}
                    </Link>
                    {firstPrompt && imageSize !== "small" && (
                      <button
                        className="inline-flex h-6 items-center rounded-md bg-white/15 px-2 text-xs font-medium text-white backdrop-blur-sm transition-colors duration-quick hover:bg-white/25"
                        onClick={(e) => handleCopyPrompt(firstPrompt, e)}
                      >
                        {copiedId === firstPrompt.id ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <Copy className="mr-1 h-3 w-3" />
                        )}
                        Copy
                      </button>
                    )}
                    {firstPrompt && hasScene && imageSize !== "small" && (
                      <button
                        className="inline-flex h-6 items-center rounded-md bg-white/15 px-2 text-xs font-medium text-white backdrop-blur-sm transition-colors duration-quick hover:bg-white/25"
                        onClick={(e) => handleCopySceneJson(firstPrompt, e)}
                        title="Copy Ideogram (scene composition) JSON"
                      >
                        {copiedId === `scene-${firstPrompt.id}` ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <Braces className="mr-1 h-3 w-3" />
                        )}
                        Ideogram
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - hide on small size */}
            {imageSize !== "small" && (
              <div className="px-2.5 py-2">
                <p className="text-[11px] text-secondary">
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
