"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImageGrid } from "@/components/gallery/image-grid";
import { FilterBar } from "@/components/gallery/filter-bar";
import { ViewOptions, type LayoutType, type ImageSize } from "@/components/gallery/view-options";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { supabase, getThumbnailUrl } from "@/lib/supabase/client";
import type { ImageAsset, AssetTag, Prompt, Collection } from "@/lib/supabase/types";

interface ImageWithDetails extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

const MAX_VISIBLE_THUMBS = 5;

export default function GalleryPage() {
  const [images, setImages] = useState<ImageWithDetails[]>([]);
  const [allImagesCount, setAllImagesCount] = useState(0);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "upload" | "gallery_dl">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Full objects survive filter changes
  const [selectedImageMap, setSelectedImageMap] = useState<Map<string, ImageWithDetails>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<LayoutType>("full");
  const [imageSize, setImageSize] = useState<ImageSize>("large");

  const hasActiveFilters =
    selectedTags.length > 0 || selectedCollections.length > 0 || sourceFilter !== "all";

  useEffect(() => {
    fetchImages();
    fetchTags();
  }, [selectedTags, selectedCollections, sourceFilter, sortBy]);

  useEffect(() => { fetchCollections(); }, []);

  async function fetchImages() {
    setIsLoading(true);
    let collectionAssetIds: string[] | null = null;

    if (selectedCollections.length > 0) {
      const { data: ca } = await supabase
        .from("collection_assets")
        .select("asset_id")
        .in("collection_id", selectedCollections);
      collectionAssetIds = [...new Set(ca?.map((r) => r.asset_id) || [])];
      if (collectionAssetIds.length === 0) { setImages([]); setIsLoading(false); return; }
    }

    let query = supabase
      .from("image_assets")
      .select(`*, tags:asset_tags(*), prompts:prompts(*)`)
      .order("created_at", { ascending: sortBy === "oldest" });

    if (sourceFilter !== "all") query = query.eq("source_type", sourceFilter);
    if (collectionAssetIds) query = query.in("id", collectionAssetIds);

    const { data } = await query;
    let filtered = (data || []) as ImageWithDetails[];

    if (selectedTags.length > 0) {
      filtered = filtered.filter((img) =>
        selectedTags.every((tag) => img.tags?.some((t: AssetTag) => t.tag === tag))
      );
    }

    setImages(filtered);
    if (!hasActiveFilters) setAllImagesCount(filtered.length);
    setIsLoading(false);
  }

  async function fetchTags() {
    const { data } = await supabase.from("asset_tags").select("tag").order("tag");
    if (data) setAllTags([...new Set(data.map((t) => t.tag))]);
  }

  async function fetchCollections() {
    const { data } = await supabase.from("collections").select("*").order("name");
    if (data) setCollections(data);
  }

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

  function handleDeselect(id: string) {
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    setSelectedImageMap((prev) => { const n = new Map(prev); n.delete(id); return n; });
  }

  function handleClearSelection() {
    setSelectedIds([]);
    setSelectedImageMap(new Map());
  }

  const selectedImageObjects = Array.from(selectedImageMap.values());
  const visibleThumbs = selectedImageObjects.slice(0, MAX_VISIBLE_THUMBS);
  const overflow = selectedImageObjects.length - MAX_VISIBLE_THUMBS;

  const skeletonGridClasses = {
    small: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
    medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    large: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header
          title="Gallery"
          description={
            isLoading ? "" :
            hasActiveFilters ? `${images.length} of ${allImagesCount} images` :
            `${images.length} image${images.length !== 1 ? "s" : ""}`
          }
          actions={
            <div className="flex items-center gap-2">
              {/* ── Selected image thumbnails ── */}
              {selectedImageObjects.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {/* Stacked thumbnails */}
                  <div className="flex items-center">
                    {visibleThumbs.map((img, i) => (
                      <div
                        key={img.id}
                        className="group/thumb relative"
                        style={{ marginLeft: i > 0 ? "-8px" : "0", zIndex: visibleThumbs.length - i }}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-12 w-12 overflow-hidden rounded-lg border-2 border-white shadow-sm ring-1 ring-black/10">
                          <Image
                            src={getThumbnailUrl(img.storage_path)}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                          {/* × on hover */}
                          <button
                            onClick={() => handleDeselect(img.id)}
                            className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/thumb:bg-black/50 group-hover/thumb:opacity-100"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>

                        {/* natural_prompt tooltip — drops below header */}
                        {img.prompts?.[0]?.natural_prompt && (
                          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-xl">
                              <p className="line-clamp-5 text-[10px] leading-relaxed text-gray-700">
                                {img.prompts[0].natural_prompt}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Overflow badge */}
                    {overflow > 0 && (
                      <div
                        className="relative z-0 ml-[-8px] flex h-12 w-12 items-center justify-center rounded-lg border-2 border-white bg-gray-100 shadow-sm ring-1 ring-black/10"
                      >
                        <span className="text-[10px] font-semibold text-gray-600">+{overflow}</span>
                      </div>
                    )}
                  </div>

                  {/* Clear all */}
                  <button
                    onClick={handleClearSelection}
                    className="ml-0.5 text-[11px] text-gray-400 transition-colors hover:text-gray-700"
                  >
                    Clear
                  </button>

                  <div className="h-4 w-px bg-gray-200" />
                </div>
              )}

              {selectedIds.length > 0 && (
                <Link href={`/playground?images=${selectedIds.join(",")}`}>
                  <Button>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Remix ({selectedIds.length})
                  </Button>
                </Link>
              )}

              <ViewOptions
                layout={layout}
                onLayoutChange={setLayout}
                imageSize={imageSize}
                onImageSizeChange={setImageSize}
              />

              <Link href="/upload">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </Link>
            </div>
          }
        />

        <div className="p-6 space-y-6">
          <FilterBar
            tags={allTags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            collections={collections}
            selectedCollections={selectedCollections}
            onCollectionsChange={setSelectedCollections}
          />

          {isLoading ? (
            <div className={`grid gap-4 ${skeletonGridClasses[imageSize]}`}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-xl bg-black/[0.06]"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
          ) : (
            <ImageGrid
              images={images}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              onDelete={(id) => {
                setImages((prev) => prev.filter((img) => img.id !== id));
                handleDeselect(id);
              }}
              layout={layout}
              imageSize={imageSize}
            />
          )}
        </div>
      </main>
    </div>
  );
}
