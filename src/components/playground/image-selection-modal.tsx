"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/gallery/filter-bar";
import { cn } from "@/lib/utils";
import { supabase, getThumbnailUrl, getImageUrl } from "@/lib/supabase/client";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";
import { X, Check, Images, Loader2 } from "lucide-react";

interface ImageWithDetails extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

interface ImageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (images: ImageWithDetails[]) => void;
  initialSelectedIds?: string[];
}

export function ImageSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = [],
}: ImageSelectionModalProps) {
  const [images, setImages] = useState<ImageWithDetails[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [isLoading, setIsLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Filter state
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "upload" | "gallery_dl">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const fetchImages = useCallback(async () => {
    setIsLoading(true);

    let query = supabase
      .from("image_assets")
      .select(`
        *,
        tags:asset_tags(*),
        prompts:prompts(*)
      `)
      .order("created_at", { ascending: sortBy === "oldest" });

    if (sourceFilter !== "all") {
      query = query.eq("source_type", sourceFilter);
    }

    const { data } = await query;

    if (data) {
      let filteredData = data as ImageWithDetails[];

      // Filter by tags if any selected
      if (selectedTags.length > 0) {
        filteredData = filteredData.filter((image) =>
          image.tags?.some((tag) => selectedTags.includes(tag.tag))
        );
      }

      setImages(filteredData);

      // Extract unique tags
      const tags = new Set<string>();
      (data as ImageWithDetails[]).forEach((image) => {
        image.tags?.forEach((tag) => tags.add(tag.tag));
      });
      setAllTags(Array.from(tags).sort());
    }

    setIsLoading(false);
  }, [sourceFilter, sortBy, selectedTags]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      fetchImages();
    }
  }, [isOpen, initialSelectedIds, fetchImages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    const selectedImages = images.filter((img) => selectedIds.includes(img.id));
    onConfirm(selectedImages);
    onClose();
  };

  const handleImageError = (imageId: string) => {
    setFailedImages((prev) => new Set(prev).add(imageId));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20">
              <Images className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Select Images</h2>
              <p className="text-sm text-white/60">
                Choose images to remix their prompts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {selectedIds.length} selected
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-white/10 px-6 py-4">
          <FilterBar
            tags={allTags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/40" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Images className="h-12 w-12 text-white/20" />
              <p className="mt-4 text-white/60">No images found</p>
              <p className="text-sm text-white/40">
                Try adjusting your filters or upload some images
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {images.map((image) => {
                const isSelected = selectedIds.includes(image.id);
                const useFallback = failedImages.has(image.id);
                const imageUrl = useFallback
                  ? getImageUrl(image.storage_path)
                  : getThumbnailUrl(image.storage_path);

                return (
                  <button
                    key={image.id}
                    onClick={() => handleToggleSelect(image.id)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                      isSelected
                        ? "border-purple-500 ring-2 ring-purple-500/50"
                        : "border-transparent hover:border-white/30"
                    )}
                  >
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                      onError={() => handleImageError(image.id)}
                    />

                    {/* Selection indicator */}
                    <div
                      className={cn(
                        "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                        isSelected
                          ? "border-purple-500 bg-purple-500"
                          : "border-white/50 bg-black/50 opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>

                    {/* Hover overlay with tags */}
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="w-full p-2">
                        {image.tags && image.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {image.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-[9px]"
                              >
                                {tag.tag}
                              </Badge>
                            ))}
                            {image.tags.length > 2 && (
                              <Badge variant="secondary" className="text-[9px]">
                                +{image.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="text-white/60"
              >
                Clear selection
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="min-w-[140px]"
            >
              Add {selectedIds.length > 0 ? `${selectedIds.length} images` : "images"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
