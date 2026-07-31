"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImageGrid } from "@/components/gallery/image-grid";
import { GallerySkeleton } from "@/components/gallery/gallery-skeleton";
import { useImageSelection } from "@/hooks/use-image-selection";
import { FilterBar } from "@/components/gallery/filter-bar";
import { ViewOptions, type LayoutType, type ImageSize } from "@/components/gallery/view-options";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, getThumbnailUrl } from "@/lib/supabase/client";
import type { AssetTag, Collection } from "@/lib/supabase/types";
import {
  getGalleryCache,
  updateGalleryCache,
  setGalleryScroll,
  type ImageWithDetails,
} from "@/lib/gallery-cache";

const MAX_VISIBLE_THUMBS = 5;

export default function GalleryPage() {
  // Hydrate from the module cache so a return navigation renders instantly
  // from memory (full height on the first frame → scroll can be restored).
  const cached = getGalleryCache();
  const [images, setImages] = useState<ImageWithDetails[]>(cached.images ?? []);
  const [allImagesCount, setAllImagesCount] = useState(cached.allImagesCount);
  const [allTags, setAllTags] = useState<string[]>(cached.tags);
  const [collections, setCollections] = useState<Collection[]>(cached.collections);
  const [selectedTags, setSelectedTags] = useState<string[]>(cached.filters.selectedTags);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    cached.filters.selectedCollections
  );
  const [sourceFilter, setSourceFilter] = useState<"all" | "upload" | "gallery_dl">(
    cached.filters.sourceFilter
  );
  const [sortBy, setSortBy] = useState<"newest" | "oldest">(cached.filters.sortBy);

  const {
    selectedIds,
    selectedImages: selectedImageObjects,
    handleSelectionChange,
    deselect: handleDeselect,
    clear: handleClearSelection,
  } = useImageSelection(images);

  const [isLoading, setIsLoading] = useState(cached.images === null);
  const [layout, setLayout] = useState<LayoutType>("full");
  const [imageSize, setImageSize] = useState<ImageSize>("medium");

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  const filtersInitialized = useRef(false);

  const hasActiveFilters =
    selectedTags.length > 0 || selectedCollections.length > 0 || sourceFilter !== "all";

  useEffect(() => {
    fetchImages();
    fetchTags();
  }, [selectedTags, selectedCollections, sourceFilter, sortBy]);

  useEffect(() => { fetchCollections(); }, []);

  // Keep the module cache mirroring state so a return navigation can re-render
  // from memory, and so deletes/uploads/filter changes don't leave it stale.
  useEffect(() => {
    updateGalleryCache({
      images,
      allImagesCount,
      tags: allTags,
      collections,
      filters: { selectedTags, selectedCollections, sourceFilter, sortBy },
    });
  }, [
    images,
    allImagesCount,
    allTags,
    collections,
    selectedTags,
    selectedCollections,
    sourceFilter,
    sortBy,
  ]);

  // Persist scroll position (rAF-throttled) and take scroll restoration away
  // from the browser/router so it can't reset us to the top. Only save while
  // we're actually on the gallery route, so scrolling an image page (if this
  // component stays mounted in the router cache) doesn't clobber the value.
  useEffect(() => {
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let ticking = false;
    const onScroll = () => {
      if (pathnameRef.current !== "/" || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY;
        // A navigation away briefly fires a scroll-to-0 that would otherwise
        // erase the saved position. Only persist a real top (when the saved
        // value is already small); ignore the transient reset.
        if (y === 0 && getGalleryCache().scrollY > 200) return;
        setGalleryScroll(y);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.history.scrollRestoration = prevRestoration;
    };
  }, []);

  // Restore scroll whenever we (re)arrive at the gallery — keyed on pathname so
  // it fires on a fresh mount AND when the router keeps this component cached
  // and just flips the route back to "/". The list is already hydrated from
  // cache (full height), so the first scrollTo lands; the rAF loop then keeps
  // re-asserting until it's stable, defeating Next's post-navigation reset, and
  // stops as soon as the target holds (so it never fights the user).
  useLayoutEffect(() => {
    if (pathname !== "/") return;
    const c = getGalleryCache();
    if (!c.images || c.images.length === 0 || c.scrollY <= 0) return;
    const target = c.scrollY;
    let frame = 0;
    let stable = 0;
    let raf = 0;
    const tick = () => {
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) <= 1) stable++;
      else stable = 0;
      frame++;
      if (stable < 3 && frame < 40) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  // A real filter/sort change (not the initial mount) resets to the top.
  useEffect(() => {
    if (!filtersInitialized.current) {
      filtersInitialized.current = true;
      return;
    }
    setGalleryScroll(0);
    window.scrollTo(0, 0);
  }, [selectedTags, selectedCollections, sourceFilter, sortBy]);

  async function fetchImages() {
    // Only show the skeleton on a cold load — a warm return or a background
    // revalidate keeps the existing grid (and its scroll position) on screen.
    if (images.length === 0) setIsLoading(true);
    let collectionAssetIds: string[] | null = null;

    if (selectedCollections.length > 0) {
      const { data: ca } = await supabase
        .from("collection_assets")
        .select("asset_id")
        .in("collection_id", selectedCollections);
      collectionAssetIds = [...new Set(ca?.map((r) => r.asset_id) || [])];
      if (collectionAssetIds.length === 0) { setImages([]); setIsLoading(false); return; }
    }

    // Supabase enforces a server-side max-rows cap (1000) per request, so a
    // single query silently truncates. Page through in chunks until a short
    // page signals the end, then concatenate.
    const PAGE = 1000;
    const all: ImageWithDetails[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from("image_assets")
        .select(`*, tags:asset_tags(*), prompts:prompts(*)`)
        .order("created_at", { ascending: sortBy === "oldest" })
        .range(from, from + PAGE - 1);

      if (sourceFilter !== "all") query = query.eq("source_type", sourceFilter);
      if (collectionAssetIds) query = query.in("id", collectionAssetIds);

      const { data } = await query;
      const page = (data || []) as ImageWithDetails[];
      all.push(...page);
      if (page.length < PAGE) break;
    }

    let filtered = all;

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

  const visibleThumbs = selectedImageObjects.slice(0, MAX_VISIBLE_THUMBS);
  const overflow = selectedImageObjects.length - MAX_VISIBLE_THUMBS;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-60">
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
                            <div className="rounded-xl border border-hairline bg-surface p-3 shadow-xl">
                              <p className="line-clamp-5 text-[10px] leading-relaxed text-secondary">
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
                        className="relative z-0 ml-[-8px] flex h-12 w-12 items-center justify-center rounded-lg border-2 border-white bg-accent-faint shadow-sm ring-1 ring-black/10"
                      >
                        <span className="text-[10px] font-semibold text-secondary">+{overflow}</span>
                      </div>
                    )}
                  </div>

                  {/* Clear all */}
                  <button
                    onClick={handleClearSelection}
                    className="ml-0.5 text-[11px] text-tertiary transition-colors hover:text-secondary"
                  >
                    Clear
                  </button>

                  <div className="h-4 w-px bg-accent-soft" />
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
            <GallerySkeleton imageSize={imageSize} />
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
