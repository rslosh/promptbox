"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/gallery/filter-bar";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";
import { supabase, getThumbnailUrl, getImageUrl } from "@/lib/supabase/client";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";
import type { SortBy } from "@/lib/gallery-cache";
import { X, Check, Images, Loader2, Copy } from "lucide-react";

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
  // Full image objects — survive filter changes so the tray stays populated
  const [selectedImageObjects, setSelectedImageObjects] = useState<ImageWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "upload" | "gallery_dl">("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  // Ref so fetchImages can read initialSelectedIds without it being a dep
  // (avoids the callback being recreated on every parent render, which would
  //  cause the open-effect to re-fire and wipe selectedImageObjects)
  const initialSelectedIdsRef = useRef(initialSelectedIds);
  useEffect(() => {
    initialSelectedIdsRef.current = initialSelectedIds;
  }, [initialSelectedIds]);

  const fetchImages = useCallback(async () => {
    setIsLoading(true);

    let query = supabase
      .from("image_assets")
      .select(`*, tags:asset_tags(*), prompts:prompts(*)`)
      .order("created_at", { ascending: sortBy === "oldest" });

    if (sourceFilter !== "all") {
      query = query.eq("source_type", sourceFilter);
    }

    const { data } = await query;

    if (data) {
      let filteredData = data as ImageWithDetails[];
      if (selectedTags.length > 0) {
        filteredData = filteredData.filter((image) =>
          image.tags?.some((tag) => selectedTags.includes(tag.tag))
        );
      }
      if (sortBy === "random") {
        filteredData = [...filteredData].sort(() => Math.random() - 0.5);
      }
      setImages(filteredData);

      const tags = new Set<string>();
      (data as ImageWithDetails[]).forEach((img) => img.tags?.forEach((t) => tags.add(t.tag)));
      setAllTags(Array.from(tags).sort());

      // Populate selectedImageObjects from initial IDs — only when empty (first open)
      setSelectedImageObjects((prev) => {
        if (prev.length > 0) return prev;
        const ids = initialSelectedIdsRef.current;
        return ids.length > 0
          ? (data as ImageWithDetails[]).filter((img) => ids.includes(img.id))
          : [];
      });
    }

    setIsLoading(false);
  }, [sourceFilter, sortBy, selectedTags]); // ← no initialSelectedIds here

  // Effect 1: reset state only when the modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedImageObjects([]);
    }
  }, [isOpen]);

  // Effect 2: fetch whenever modal is open or filters change
  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, fetchImages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleToggleSelect = (image: ImageWithDetails) => {
    const id = image.id;
    setSelectedImageObjects((prev) => {
      if (prev.find((i) => i.id === id)) return prev.filter((i) => i.id !== id);
      return [...prev, image];
    });
  };

  const handleDeselect = (id: string) => {
    setSelectedImageObjects((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => setSelectedImageObjects([]);

  const handleConfirm = () => {
    onConfirm(selectedImageObjects);
    onClose();
  };

  const handleCopyPrompt = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(prompt.natural_prompt);
    if (success) {
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleImageError = (imageId: string) =>
    setFailedImages((prev) => new Set(prev).add(imageId));

  const selectedIds = selectedImageObjects.map((i) => i.id);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hairline gos-glass shadow-2xl backdrop-blur-xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-faint">
              <Images className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Select Images</h2>
              <p className="text-sm text-secondary">Choose images to remix their prompts</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Filters */}
        <div className="shrink-0 border-b border-hairline px-6 py-4">
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

        {/* ── Selection tray ── */}
        {selectedImageObjects.length > 0 && (
          <div className="shrink-0 border-b border-hairline bg-hover-soft/80 px-6 py-3">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-tertiary">
                Selected ({selectedImageObjects.length})
              </span>
              <button
                onClick={handleClearAll}
                className="text-[11px] text-tertiary transition-colors hover:text-secondary"
              >
                Clear all
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {selectedImageObjects.map((img) => {
                const prompt = img.prompts?.[0];
                return (
                  <div
                    key={img.id}
                    className="group/tray relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl border-2 border-accent/25"
                  >
                    <Image
                      src={getThumbnailUrl(img.storage_path)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                    {prompt?.natural_prompt && (
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 opacity-0 transition-opacity group-hover/tray:opacity-100">
                        <p className="line-clamp-4 text-[9px] leading-relaxed text-white/90">
                          {prompt.natural_prompt}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => handleDeselect(img.id)}
                      className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-on-accent transition-colors hover:bg-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-tertiary" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Images className="h-12 w-12 text-icon-muted" />
              <p className="mt-4 text-secondary">No images found</p>
              <p className="text-sm text-secondary">Try adjusting your filters or upload some images</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {images.map((image) => {
                const isSelected = selectedIds.includes(image.id);
                const useFallback = failedImages.has(image.id);
                const imageUrl = useFallback
                  ? getImageUrl(image.storage_path)
                  : getThumbnailUrl(image.storage_path);
                const prompt = image.prompts?.[0];

                return (
                  <button
                    key={image.id}
                    onClick={() => handleToggleSelect(image)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                      isSelected
                        ? "border-accent ring-2 ring-accent/20"
                        : "border-transparent hover:border-strong"
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
                        "absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                        isSelected
                          ? "border-accent bg-accent"
                          : "border-white/70 bg-black/30 opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>

                    {/* Hover overlay — prompt preview + copy */}
                    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="p-2">
                        {prompt?.natural_prompt && (
                          <p className="mb-1.5 line-clamp-3 text-[9px] leading-relaxed text-white/85">
                            {prompt.natural_prompt}
                          </p>
                        )}
                        {prompt && (
                          <button
                            onClick={(e) => handleCopyPrompt(prompt, e)}
                            className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm transition-colors hover:bg-white/25"
                          >
                            {copiedId === prompt.id ? (
                              <><Check className="h-3 w-3" /> Copied</>
                            ) : (
                              <><Copy className="h-3 w-3" /> Copy prompt</>
                            )}
                          </button>
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
        <div className="flex shrink-0 items-center justify-between border-t border-hairline px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedImageObjects.length === 0}
            className="min-w-[140px]"
          >
            Add {selectedImageObjects.length > 0
              ? `${selectedImageObjects.length} image${selectedImageObjects.length !== 1 ? "s" : ""}`
              : "images"}
          </Button>
        </div>
      </div>
    </div>
  );
}
