"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImageGrid } from "@/components/gallery/image-grid";
import { FilterBar } from "@/components/gallery/filter-bar";
import { ViewOptions, type LayoutType, type ImageSize } from "@/components/gallery/view-options";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { ImageAsset, AssetTag, Prompt, Collection } from "@/lib/supabase/types";

interface ImageWithDetails extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

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
  const [isLoading, setIsLoading] = useState(true);

  const hasActiveFilters =
    selectedTags.length > 0 ||
    selectedCollections.length > 0 ||
    sourceFilter !== "all";
  
  // View options
  const [layout, setLayout] = useState<LayoutType>("full");
  const [imageSize, setImageSize] = useState<ImageSize>("large");

  useEffect(() => {
    fetchImages();
    fetchTags();
  }, [selectedTags, selectedCollections, sourceFilter, sortBy]);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchImages() {
    setIsLoading(true);

    // If filtering by collections, first get the asset IDs in those collections
    let collectionAssetIds: string[] | null = null;
    if (selectedCollections.length > 0) {
      const { data: collectionAssets, error: caError } = await supabase
        .from("collection_assets")
        .select("asset_id")
        .in("collection_id", selectedCollections);

      if (caError) {
        console.error("Error fetching collection assets:", caError);
        setIsLoading(false);
        return;
      }

      collectionAssetIds = [...new Set(collectionAssets?.map((ca) => ca.asset_id) || [])];
      
      // If no assets in selected collections, show empty
      if (collectionAssetIds.length === 0) {
        setImages([]);
        setIsLoading(false);
        return;
      }
    }

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

    // Filter by collection asset IDs if applicable
    if (collectionAssetIds) {
      query = query.in("id", collectionAssetIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching images:", error);
      setIsLoading(false);
      return;
    }

    let filteredData = data || [];

    // Filter by tags if any selected
    if (selectedTags.length > 0) {
      filteredData = filteredData.filter((image) =>
        selectedTags.every((tag) =>
          image.tags?.some((t: AssetTag) => t.tag === tag)
        )
      );
    }

    setImages(filteredData);
    // Track total unfiltered count for the header description
    if (!hasActiveFilters) setAllImagesCount(filteredData.length);
    setIsLoading(false);
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from("asset_tags")
      .select("tag")
      .order("tag");

    if (error) {
      console.error("Error fetching tags:", error);
      return;
    }

    const uniqueTags = [...new Set(data?.map((t) => t.tag) || [])];
    setAllTags(uniqueTags);
  }

  async function fetchCollections() {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching collections:", error);
      return;
    }

    setCollections(data || []);
  }

  // Get grid column classes based on image size for skeleton loading
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
            isLoading
              ? ""
              : hasActiveFilters
              ? `${images.length} of ${allImagesCount} images`
              : `${images.length} image${images.length !== 1 ? "s" : ""}`
          }
          actions={
            <div className="flex gap-2">
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
                  className="aspect-square animate-pulse rounded-xl bg-white/5"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
          ) : (
            <ImageGrid
              images={images}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onDelete={(id) => {
                setImages((prev) => prev.filter((img) => img.id !== id));
                setSelectedIds((prev) => prev.filter((i) => i !== id));
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
