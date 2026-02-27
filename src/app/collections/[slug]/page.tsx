"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImageGrid } from "@/components/gallery/image-grid";
import { ViewOptions, type LayoutType, type ImageSize } from "@/components/gallery/view-options";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ExternalLink,
  Sparkles,
  Loader2,
  Check,
  Clock,
  ImageIcon,
  Wand2,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { IconWell } from "@/components/ui/icon-well";
import { EmptyState } from "@/components/ui/empty-state";
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

const platformColors: Record<string, string> = {
  pinterest: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  are_na: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  tumblr: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  manual: "text-white/50 bg-white/5 border-white/10",
};

export default function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevImageCount = useRef<number>(0);
  const syncStartAssetIds = useRef<Set<string>>(new Set());

  // View options
  const [layout, setLayout] = useState<LayoutType>("full");
  const [imageSize, setImageSize] = useState<ImageSize>("large");

  // Close delete popover on outside click
  useEffect(() => {
    if (!confirmDelete) return;
    function handleClick(e: MouseEvent) {
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) {
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [confirmDelete]);

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

        // Sort new assets to the top
        const preExisting = syncStartAssetIds.current;
        const sorted = [
          ...data.assets.filter((a: { id: string }) => !preExisting.has(a.id)).reverse(),
          ...data.assets.filter((a: { id: string }) => preExisting.has(a.id)),
        ];
        setCollection({ ...data, assets: sorted });

        if (addedCount > 0) {
          setSyncProgress((prev) => ({
            ...prev,
            imagesFound: prev.imagesFound + addedCount,
            message: `Found ${addedCount} new image${addedCount === 1 ? "" : "s"}...`,
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
            const finalData = await fetchCollection();
            if (finalData) {
              const preExisting = syncStartAssetIds.current;
              const sorted = [
                ...finalData.assets.filter((a: { id: string }) => !preExisting.has(a.id)).reverse(),
                ...finalData.assets.filter((a: { id: string }) => preExisting.has(a.id)),
              ];
              setCollection({ ...finalData, assets: sorted });
              setSyncProgress((prev) => ({
                status: "complete",
                imagesFound: prev.imagesFound,
                imagesTagged: prev.imagesFound,
                message:
                  prev.imagesFound > 0
                    ? `Added ${prev.imagesFound} new image${prev.imagesFound === 1 ? "" : "s"}!`
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
            setSyncProgress((prev) => ({
              ...prev,
              status: "tagging",
              message:
                prev.imagesFound > 0
                  ? `Tagging ${prev.imagesFound} new image${prev.imagesFound === 1 ? "" : "s"}...`
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

    syncStartAssetIds.current = new Set(collection.assets?.map((a) => a.id) || []);
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

      if (!response.ok) throw new Error("Sync failed");

      const data = await response.json();
      if (data.job?.id) setJobId(data.job.id);
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

  async function handleDelete() {
    if (!collection) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      router.push("/");
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
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
          <div className="flex h-full min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <ImageIcon className="h-5 w-5 text-white/30" />
              </div>
              <h2 className="text-base font-medium text-white">{error}</h2>
              <Link
                href="/"
                className="mt-3 inline-block text-sm text-white/40 transition-colors hover:text-white/70"
              >
                ← Back to Gallery
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
        {/* Header */}
        <Header
          title={isLoading ? "Loading..." : collection?.name || "Collection"}
          description={
            isLoading
              ? ""
              : isSyncing
              ? `${collection?.assets?.length || 0} images · syncing`
              : `${collection?.assets?.length || 0} images`
          }
          actions={
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Link href={`/playground?images=${selectedIds.join(",")}`}>
                  <Button size="sm">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Remix {selectedIds.length}
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
                  {/* Sync button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="gap-1.5"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Syncing
                      </>
                    ) : syncProgress.status === "complete" && syncProgress.imagesFound > 0 ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Synced
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Sync
                      </>
                    )}
                  </Button>

                  {/* External link */}
                  <a href={collection.source_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </>
              )}

              {/* Delete — with popover confirmation */}
              {collection && (
                <div ref={deleteRef} className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 transition-colors",
                      confirmDelete
                        ? "bg-red-500/15 text-red-400"
                        : "text-white/30 hover:text-red-400 hover:bg-red-500/10"
                    )}
                    onClick={() => setConfirmDelete((v) => !v)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  {/* Confirmation popover */}
                  {confirmDelete && (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 rounded-xl border border-white/10 bg-[#111] p-4 shadow-2xl backdrop-blur-xl">
                      <div className="mb-3 flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                          <AlertTriangle className="h-3 w-3 text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Delete collection?</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                            Images stay in your gallery. This can&rsquo;t be undone.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 text-xs text-red-400 transition-colors hover:bg-red-500/25 hover:text-red-300 disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
        />

        {/* Sync progress bar — thin strip under header */}
        <div
          className={cn(
            "h-[2px] w-full transition-opacity duration-500",
            isSyncing ? "opacity-100" : "opacity-0"
          )}
        >
          <div
            className={cn(
              "h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-[length:200%_100%]",
              isSyncing && "animate-[shimmer_1.5s_ease-in-out_infinite]"
            )}
            style={{
              animation: isSyncing
                ? "shimmer 1.5s ease-in-out infinite"
                : undefined,
            }}
          />
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>

        <div className="p-6 space-y-5">
          {/* Collection meta row */}
          {!isLoading && collection && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Platform badge */}
              <Chip className={cn(platformColors[collection.platform] ?? platformColors.manual)}>
                {platformLabels[collection.platform]}
              </Chip>

              {/* Last synced */}
              {collection.last_synced_at && (
                <span className="flex items-center gap-1.5 text-xs text-white/30">
                  <Clock className="h-3 w-3" />
                  {formatDate(collection.last_synced_at)}
                </span>
              )}

              {/* Description */}
              {collection.description && (
                <>
                  <span className="text-white/15">·</span>
                  <p className="text-xs text-white/40">{collection.description}</p>
                </>
              )}

              {/* Sync status chip */}
              {isSyncing && (
                <Chip variant="accent" className="ml-auto">
                  {syncProgress.status === "downloading" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3 animate-pulse" />
                  )}
                  {syncProgress.status === "downloading" ? "Downloading" : "Tagging with AI"}
                  {syncProgress.imagesFound > 0 && (
                    <span className="ml-0.5 rounded-full bg-purple-500/20 px-1.5 py-px font-medium tabular-nums">
                      {syncProgress.imagesFound} new
                    </span>
                  )}
                </Chip>
              )}

              {/* Sync complete chip */}
              {!isSyncing && syncProgress.status === "complete" && syncProgress.imagesFound > 0 && (
                <Chip variant="success" className="ml-auto">
                  <Check className="h-3 w-3" />
                  {syncProgress.imagesFound} new image{syncProgress.imagesFound === 1 ? "" : "s"} added
                </Chip>
              )}

              {/* Failed chip */}
              {!isSyncing && syncProgress.status === "failed" && (
                <Chip variant="danger" className="ml-auto">
                  <AlertTriangle className="h-3 w-3" />
                  {syncProgress.message}
                </Chip>
              )}
            </div>
          )}

          {/* Image Grid */}
          {isLoading ? (
            <div className={`grid gap-3 ${skeletonGridClasses[imageSize]}`}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-xl bg-white/5"
                  style={{ animationDelay: `${i * 40}ms` }}
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
            /* Syncing empty state */
            <div className="flex flex-col items-center justify-center py-24">
              <div className="relative mb-5">
                <IconWell size="xl" variant="accent" className="opacity-40" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-purple-400/60" />
              </div>
              <p className="text-sm font-medium text-white/60">Downloading images&hellip;</p>
              <p className="mt-1 text-xs text-white/25">Large boards may take a moment</p>
            </div>
          ) : (
            /* Empty state */
            <EmptyState
              icon={ImageIcon}
              title="No images yet"
              description={`Sync this collection to import from ${platformLabels[collection?.platform ?? "manual"]}`}
              action={
                collection?.source_url
                  ? { label: `Sync from ${platformLabels[collection.platform]}`, onClick: handleSync }
                  : undefined
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
