"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImageGrid } from "@/components/gallery/image-grid";
import { ViewOptions, type LayoutType, type ImageSize } from "@/components/gallery/view-options";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  ExternalLink,
  Sparkles,
  Loader2,
  Check,
  Clock,
  ImageIcon,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import type { Collection, ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";

interface CollectionWithAssets extends Collection {
  assets: (ImageAsset & {
    tags?: AssetTag[];
    prompts?: Prompt[];
    position: number;
  })[];
}

interface SyncProgress {
  status: "downloading" | "tagging" | "complete" | "failed";
  imagesFound: number;
  imagesTagged: number;
  message: string;
}

const platformLabels: Record<string, string> = {
  pinterest: "Pinterest",
  are_na: "Are.na",
  tumblr: "Tumblr",
  manual: "Manual",
};

export default function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const initialSyncing = searchParams.get("syncing") === "true";
  const initialJobId = searchParams.get("job");
  const [jobId, setJobId] = useState<string | null>(initialJobId);

  const [collection, setCollection] = useState<CollectionWithAssets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(initialSyncing);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: initialSyncing ? "downloading" : "complete",
    imagesFound: 0,
    imagesTagged: 0,
    message: initialSyncing ? "Downloading images from Pinterest..." : "",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevImageCount = useRef<number>(0);

  // View options
  const [layout, setLayout] = useState<LayoutType>("full");
  const [imageSize, setImageSize] = useState<ImageSize>("large");

  const fetchCollection = useCallback(async () => {
    try {
      const response = await fetch(`/api/collections/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Collection not found");
        } else {
          setError("Failed to load collection");
        }
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Error fetching collection:", err);
      setError("Failed to load collection");
      return null;
    }
  }, [slug]);

  // Initial fetch
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const data = await fetchCollection();
      if (data) {
        setCollection(data);
        prevImageCount.current = data.assets?.length || 0;
      }
      setIsLoading(false);
    }
    init();
  }, [fetchCollection]);

  // Poll for updates during sync
  useEffect(() => {
    if (!isSyncing) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Poll collection for new images
    pollingRef.current = setInterval(async () => {
      const data = await fetchCollection();
      if (data) {
        const newCount = data.assets?.length || 0;
        const addedCount = newCount - prevImageCount.current;
        setCollection(data);

        // Only update count if we found new images
        if (addedCount > 0) {
          setSyncProgress((prev) => ({
            ...prev,
            imagesFound: prev.imagesFound + addedCount,
            message: `Found ${addedCount} new image${addedCount === 1 ? '' : 's'}...`,
          }));
          prevImageCount.current = newCount;
        }
      }
    }, 2000);

    // Poll job status to detect completion
    const jobStatusInterval = setInterval(async () => {
      if (!jobId) return;
      
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (response.ok) {
          const job = await response.json();
          
          if (job.status === "completed") {
            // Job is done - do final fetch and stop syncing
            const finalData = await fetchCollection();
            if (finalData) {
              setCollection(finalData);
              setSyncProgress((prev) => ({
                status: "complete",
                imagesFound: prev.imagesFound,
                imagesTagged: prev.imagesFound,
                message: prev.imagesFound > 0 
                  ? `Added ${prev.imagesFound} new image${prev.imagesFound === 1 ? '' : 's'}!`
                  : "Already up to date!",
              }));
            }
            setIsSyncing(false);
            window.history.replaceState({}, "", `/collections/${slug}`);
          } else if (job.status === "failed") {
            setSyncProgress({
              status: "failed",
              imagesFound: 0,
              imagesTagged: 0,
              message: job.error || "Sync failed",
            });
            setIsSyncing(false);
            window.history.replaceState({}, "", `/collections/${slug}`);
          } else if (job.status === "running") {
            // Still running - update to show we're processing
            setSyncProgress((prev) => ({
              ...prev,
              status: "tagging",
              message: prev.imagesFound > 0 
                ? `Tagging ${prev.imagesFound} new image${prev.imagesFound === 1 ? '' : 's'}...`
                : "Checking for new images...",
            }));
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    // Fallback timeout (max 5 minutes)
    const timeout = setTimeout(() => {
      setIsSyncing(false);
      setSyncProgress((prev) => ({
        ...prev,
        status: "complete",
        message: prev.imagesFound > 0 ? `Synced ${prev.imagesFound} images!` : "Sync complete!",
      }));
      window.history.replaceState({}, "", `/collections/${slug}`);
    }, 300000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(jobStatusInterval);
      clearTimeout(timeout);
    };
  }, [isSyncing, fetchCollection, jobId, slug]);

  async function handleSync() {
    if (!collection) return;

    // Store current count to track new images
    prevImageCount.current = collection.assets?.length || 0;

    setIsSyncing(true);
    setSyncProgress({
      status: "downloading",
      imagesFound: 0,
      imagesTagged: 0,
      message: `Checking ${platformLabels[collection.platform]} for new images...`,
    });

    try {
      const response = await fetch(`/api/collections/${collection.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTag: true }),
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const data = await response.json();
      console.log("Sync started:", data);
      
      // Store job ID for status polling
      if (data.job?.id) {
        setJobId(data.job.id);
      }
    } catch (err) {
      console.error("Sync error:", err);
      setIsSyncing(false);
      setSyncProgress({
        status: "failed",
        imagesFound: 0,
        imagesTagged: 0,
        message: "Sync failed. Please try again.",
      });
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Get grid column classes based on image size for skeleton loading
  const skeletonGridClasses = {
    small: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
    medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    large: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  };

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-64">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">{error}</h2>
              <Link href="/" className="mt-4 text-purple-400 hover:text-purple-300">
                Back to Gallery
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header
          title={isLoading ? "Loading..." : collection?.name || "Collection"}
          description={
            isLoading
              ? ""
              : isSyncing
              ? `${collection?.assets?.length || 0} images (syncing...)`
              : `${collection?.assets?.length || 0} images`
          }
          actions={
            <div className="flex items-center gap-3">
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

              {collection?.source_url && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : syncProgress.status === "complete" && syncProgress.imagesFound > 0 ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-400" />
                        Synced
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync
                      </>
                    )}
                  </Button>

                  <a
                    href={collection.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </>
              )}
            </div>
          }
        />

        <div className="p-6 space-y-6">
          {/* Sync Progress Banner */}
          {isSyncing && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
                  {syncProgress.status === "downloading" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  ) : syncProgress.status === "tagging" ? (
                    <Wand2 className="h-5 w-5 text-purple-400 animate-pulse" />
                  ) : (
                    <Check className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">
                    {syncProgress.status === "downloading"
                      ? "Downloading images..."
                      : syncProgress.status === "tagging"
                      ? "Auto-tagging with AI..."
                      : "Sync complete!"}
                  </p>
                  <p className="text-sm text-white/60">{syncProgress.message}</p>
                </div>
                {syncProgress.imagesFound > 0 && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      {syncProgress.imagesFound}
                    </p>
                    <p className="text-xs text-white/40">new image{syncProgress.imagesFound === 1 ? '' : 's'}</p>
                  </div>
                )}
              </div>
              {syncProgress.status === "tagging" && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collection Info */}
          {!isLoading && collection && !isSyncing && (
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {platformLabels[collection.platform]}
              </Badge>
              {collection.last_synced_at && (
                <span className="flex items-center gap-1 text-sm text-white/40">
                  <Clock className="h-3 w-3" />
                  Last synced: {formatDate(collection.last_synced_at)}
                </span>
              )}
              {collection.description && (
                <p className="text-sm text-white/60">{collection.description}</p>
              )}
            </div>
          )}

          {/* Image Grid */}
          {isLoading ? (
            <div className={`grid gap-4 ${skeletonGridClasses[imageSize]}`}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-xl bg-white/5"
                />
              ))}
            </div>
          ) : collection?.assets && collection.assets.length > 0 ? (
            <ImageGrid
              images={collection.assets}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onDelete={(id) => {
                // Remove from UI only - actual deletion would need API call
                setCollection((prev) =>
                  prev
                    ? {
                        ...prev,
                        assets: prev.assets.filter((img) => img.id !== id),
                        image_count: prev.image_count - 1,
                      }
                    : null
                );
                setSelectedIds((prev) => prev.filter((i) => i !== id));
              }}
              layout={layout}
              imageSize={imageSize}
            />
          ) : isSyncing ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-purple-500/30 bg-purple-500/5 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              <p className="mt-4 text-white/60">Downloading images...</p>
              <p className="text-sm text-white/40">This may take a moment for large boards</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 py-16">
              <ImageIcon className="h-12 w-12 text-white/20" />
              <p className="mt-4 text-white/40">No images in this collection yet</p>
              {collection?.source_url && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync from {platformLabels[collection.platform]}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
