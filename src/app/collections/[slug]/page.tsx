"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImageGrid } from "@/components/gallery/image-grid";
import { GallerySkeleton } from "@/components/gallery/gallery-skeleton";
import { useImageSelection } from "@/hooks/use-image-selection";
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
import { readTagSettings } from "@/lib/tag-settings";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { Collection, ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";

interface CollectionWithAssets extends Collection {
  assets: (ImageAsset & {
    tags?: AssetTag[];
    prompts?: Prompt[];
    position: number;
  })[];
}

interface RetagState {
  status: "idle" | "running" | "complete" | "failed";
  unfixed: number; // prompts NOT on the corrected Ideogram pipeline (need a fix)
  total: number; // all prompts in this collection
  processed: number;
  failed: number;
  message: string;
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
  cosmos: "Cosmos",
};

const platformColors: Record<string, string> = {
  pinterest: "text-rose-600 bg-rose-50 border-rose-200",
  are_na: "text-blue-600 bg-blue-50 border-blue-200",
  tumblr: "text-cyan-700 bg-cyan-50 border-cyan-200",
  manual: "text-secondary bg-hover-soft border-input",
  cosmos: "text-violet-700 bg-violet-50 border-violet-200",
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
  const {
    selectedIds,
    handleSelectionChange,
    deselect,
  } = useImageSelection(collection?.assets ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retag, setRetag] = useState<RetagState>({
    status: "idle",
    unfixed: 0,
    total: 0,
    processed: 0,
    failed: 0,
    message: "",
  });
  const [syncPopoverOpen, setSyncPopoverOpen] = useState(false);
  const [syncLimit, setSyncLimit] = useState("");
  const deleteRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevImageCount = useRef<number>(0);
  const syncStartAssetIds = useRef<Set<string>>(new Set());

  // View options
  const [layout, setLayout] = useState<LayoutType>("full");
  const [imageSize, setImageSize] = useState<ImageSize>("small");

  // Images deleted from inside the lightbox toolbar
  useEffect(() => {
    function onDeleted(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setCollection((prev) =>
        prev
          ? {
              ...prev,
              assets: prev.assets.filter((img) => img.id !== id),
              image_count: prev.image_count - 1,
            }
          : null
      );
      deselect(id);
    }
    window.addEventListener("promptbox:image-deleted", onDeleted);
    return () => window.removeEventListener("promptbox:image-deleted", onDeleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Close sync popover on outside click
  useEffect(() => {
    if (!syncPopoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (syncRef.current && !syncRef.current.contains(e.target as Node)) {
        setSyncPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [syncPopoverOpen]);

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

  // How many of this collection's prompts are not yet on the corrected Ideogram
  // pipeline (unfixed), and how many exist in total — drives the Fix button.
  const refreshRetagCounts = useCallback(async (collectionId: string) => {
    try {
      const res = await fetch(`/api/backfill-scene?collectionId=${collectionId}`);
      if (!res.ok) return;
      const d = await res.json();
      setRetag((p) => ({
        ...p,
        unfixed: typeof d.unfixed === "number" ? d.unfixed : p.unfixed,
        total: typeof d.total === "number" ? d.total : p.total,
      }));
    } catch {
      /* counts are advisory — leave the last known values in place */
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const data = await fetchCollection();
      if (data) {
        setCollection(data);
        prevImageCount.current = data.assets?.length || 0;
        refreshRetagCounts(data.id);
      }
      setIsLoading(false);
    }
    init();
  }, [fetchCollection, refreshRetagCounts]);

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
            // Tell the sidebar counts changed so "+N pending" badges clear.
            window.dispatchEvent(new CustomEvent("promptbox:collections-changed"));
          } else if (job.status === "failed") {
            setSyncProgress({
              status: "failed",
              imagesFound: 0,
              imagesTagged: 0,
              message: job.error || "Sync failed",
            });
            setIsSyncing(false);
            window.history.replaceState({}, "", `/collections/${slug}`);
            window.dispatchEvent(new CustomEvent("promptbox:collections-changed"));
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
      window.dispatchEvent(new CustomEvent("promptbox:collections-changed"));
    }, 300000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(jobStatusInterval);
      clearTimeout(timeout);
    };
  }, [isSyncing, fetchCollection, jobId, slug]);

  // Newly added images arrive untagged (captioning runs in the background
  // after upload/sync). While any recent asset still lacks a prompt, keep
  // refetching so tiles flip from "Tagging…" to done without a manual reload.
  useEffect(() => {
    if (isSyncing) return; // the sync effect already polls
    const hasFreshUntagged = collection?.assets?.some(
      (a) =>
        !(a.prompts && a.prompts.length > 0) &&
        Date.now() - new Date(a.created_at).getTime() < 15 * 60 * 1000
    );
    if (!hasFreshUntagged) return;
    const interval = setInterval(async () => {
      const data = await fetchCollection();
      if (data) setCollection(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSyncing, collection, fetchCollection]);

  async function handleSync(limitOverride?: number) {
    if (!collection) return;

    syncStartAssetIds.current = new Set(collection.assets?.map((a) => a.id) || []);
    prevImageCount.current = collection.assets?.length || 0;

    setSyncPopoverOpen(false);
    setSyncLimit("");
    setIsSyncing(true);
    setSyncProgress({
      status: "downloading",
      imagesFound: 0,
      imagesTagged: 0,
      message: `Checking ${platformLabels[collection.platform]} for new images...`,
    });

    try {
      const body: Record<string, unknown> = { autoTag: true };
      if (limitOverride) body.limit = limitOverride;

      // Forward the user's tagging settings so sync tags with the same config
      // as the image page's "Regenerate".
      body.tagSettings = readTagSettings();

      const response = await fetch(`/api/collections/${collection.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  // Repairs this collection's Ideogram prompts: re-runs SceneCompose (with the
  // current Settings) over every prompt not yet on the corrected pipeline, and
  // only those. Already-fixed prompts are skipped by the server, so running it
  // on a fully-fixed collection is a no-op — it's a fix, not a bulk re-tagger.
  // The server works in small batches; we drive it until done so a big
  // collection can't blow the request timeout.
  async function handleRetag() {
    if (!collection || retag.status === "running" || retag.unfixed === 0) return;

    const settings = readTagSettings();
    setRetag((p) => ({ ...p, status: "running", processed: 0, failed: 0, message: "Starting…" }));

    let processed = 0;
    let failed = 0;
    try {
      while (true) {
        const res = await fetch("/api/backfill-scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: settings.apiKey,
            scenePrompt: settings.scenePrompt,
            sceneModel: settings.sceneModel,
            collectionId: collection.id,
            limit: 5,
            mode: "fix",
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Retag failed (${res.status})`);
        }
        const data: {
          succeeded: number;
          failed: number;
          remaining: number;
          quotaExceeded?: boolean;
          done: boolean;
        } = await res.json();

        processed += data.succeeded;
        failed += data.failed;
        setRetag((p) => ({
          ...p,
          status: "running",
          unfixed: data.remaining,
          processed,
          failed,
          message: `Fixed ${processed} · ${data.remaining} to go`,
        }));

        // Daily Gemini quota ran out — stop and tell the user when to resume.
        if (data.quotaExceeded) {
          setRetag((p) => ({
            ...p,
            status: "failed",
            unfixed: data.remaining,
            message: `Daily Gemini quota reached — fixed ${processed}, ${data.remaining} left. Resume tomorrow.`,
          }));
          refreshRetagCounts(collection.id);
          const partial = await fetchCollection();
          if (partial) setCollection(partial);
          return;
        }

        if (data.done) break;
        // The unfixed set shrinks as rows gain aspect_ratio; zero progress means
        // the rest can't be processed (e.g. an image that won't tag) — bail.
        if (data.succeeded === 0) {
          throw new Error(`Stopped — ${data.remaining} prompt(s) could not be fixed`);
        }
      }

      setRetag((p) => ({
        ...p,
        status: "complete",
        unfixed: 0,
        message: `Fixed ${processed}${failed > 0 ? ` · ${failed} failed` : ""}`,
      }));
      const fresh = await fetchCollection();
      if (fresh) setCollection(fresh);
      refreshRetagCounts(collection.id);
    } catch (err) {
      setRetag((p) => ({
        ...p,
        status: "failed",
        message: err instanceof Error ? err.message : "Retag failed",
      }));
      refreshRetagCounts(collection.id);
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


  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-60">
          <div className="flex h-full min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-input bg-hover-soft">
                <ImageIcon className="h-5 w-5 text-secondary" />
              </div>
              <h2 className="text-base font-medium text-primary">{error}</h2>
              <Link
                href="/"
                className="mt-3 inline-block text-sm text-secondary transition-colors hover:text-primary"
              >
                ← Back to Gallery
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // How many images the running sync is still expected to add: the remote
  // total minus what's already local. Shrinks live as polled downloads land.
  // null when the platform has no known remote total (non-countable).
  const expectedNew =
    typeof collection?.remote_count === "number"
      ? collection.remote_count - (collection.assets?.length ?? 0)
      : null;
  // One skeleton per expected image (capped at 24 so huge backlogs don't fill
  // the viewport); a token 4-tile strip when the total is unknown.
  const syncSkeletonCount =
    expectedNew !== null ? Math.min(24, Math.max(0, expectedNew)) : 4;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-60">
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

              {/* Fix button — repairs Ideogram prompts not yet on the corrected
                  pipeline. Available for every collection (incl. manual uploads).
                  Once nothing is unfixed it flips to a disabled "Fixed" state, so
                  it never invites a redundant re-run. */}
              {(() => {
                const allFixed = retag.unfixed === 0 && retag.total > 0;
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetag}
                    disabled={retag.status === "running" || !collection || retag.unfixed === 0}
                    className="gap-1.5"
                    title={
                      allFixed
                        ? "All Ideogram prompts are on the corrected pipeline"
                        : `Re-run the Ideogram pass on ${retag.unfixed} image(s) using your Settings`
                    }
                  >
                    {retag.status === "running" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Fixing
                      </>
                    ) : allFixed ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Fixed
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" />
                        Fix {retag.unfixed}
                      </>
                    )}
                  </Button>
                );
              })()}

              {collection?.source_url && (
                <>
                  {/* Sync button + popover */}
                  <div ref={syncRef} className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (isSyncing) return;
                        setSyncPopoverOpen((v) => !v);
                      }}
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

                    {syncPopoverOpen && (
                      <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 rounded-xl border border-hairline gos-glass p-4 shadow-xl backdrop-blur-xl">
                        <p className="mb-2.5 text-xs font-medium text-secondary">
                          Import limit
                        </p>
                        <input
                          type="number"
                          min={1}
                          value={syncLimit}
                          onChange={(e) => setSyncLimit(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const n = syncLimit.trim() ? parseInt(syncLimit, 10) : undefined;
                              handleSync(n);
                            }
                          }}
                          placeholder="No limit"
                          autoFocus
                          className="mb-3 w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-primary placeholder-gray-400 focus:border-strong focus:outline-none focus:ring-1 focus:ring-[var(--border-strong)]"
                        />
                        <p className="mb-3 text-[11px] leading-relaxed text-tertiary">
                          Max new images to add. Duplicates are always skipped.
                        </p>
                        <button
                          onClick={() => {
                            const n = syncLimit.trim() ? parseInt(syncLimit, 10) : undefined;
                            handleSync(n);
                          }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-1.5 text-xs font-medium text-on-accent transition-colors hover:bg-accent-hover"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {syncLimit.trim() ? `Sync up to ${syncLimit}` : "Sync all new"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* External link */}
                  <a href={collection.source_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary hover:text-primary">
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
                        ? "bg-red-50 text-red-500"
                        : "text-secondary hover:text-red-500 hover:bg-red-50"
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
                    <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 rounded-xl border border-hairline gos-glass p-4 shadow-xl backdrop-blur-xl">
                      <div className="mb-3 flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-200">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary">Delete collection?</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-secondary">
                            Images stay in your gallery. This can&rsquo;t be undone.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-input text-xs text-secondary transition-colors hover:bg-hover-soft hover:text-primary"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
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
              "h-full bg-gradient-to-r from-accent/70 via-accent to-accent/70 bg-[length:200%_100%]",
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
                <span className="flex items-center gap-1.5 text-xs text-secondary">
                  <Clock className="h-3 w-3" />
                  {formatDate(collection.last_synced_at)}
                </span>
              )}

              {/* Description */}
              {collection.description && (
                <>
                  <span className="text-tertiary">·</span>
                  <p className="text-xs text-secondary">{collection.description}</p>
                </>
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

          {/* Sync progress banner — deliberately loud so an in-flight sync is
              unmissable; new images stream into the grid below as they land */}
          {isSyncing && (
            <div className="flex items-center gap-3 rounded-xl border border-hairline bg-accent-faint px-4 py-3">
              {syncProgress.status === "downloading" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : (
                <Wand2 className="h-4 w-4 shrink-0 animate-pulse text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">
                  {syncProgress.status === "downloading"
                    ? "Syncing collection…"
                    : "Tagging new images with AI…"}
                </p>
                <p className="truncate text-xs text-secondary">{syncProgress.message}</p>
              </div>
              {syncProgress.imagesFound > 0 && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-on-accent">
                  {syncProgress.imagesFound} new
                </span>
              )}
            </div>
          )}

          {/* Retag status */}
          {retag.status !== "idle" && retag.message && (
            <div className="mb-4 flex items-center gap-2">
              {retag.status === "running" ? (
                <Chip variant="default">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {retag.message}
                </Chip>
              ) : retag.status === "failed" ? (
                <Chip variant="danger">
                  <AlertTriangle className="h-3 w-3" />
                  {retag.message}
                </Chip>
              ) : (
                <Chip variant="success">
                  <Check className="h-3 w-3" />
                  {retag.message}
                </Chip>
              )}
            </div>
          )}

          {/* Image Grid */}
          {isLoading ? (
            <GallerySkeleton imageSize={imageSize} />
          ) : collection?.assets && collection.assets.length > 0 ? (
            <>
              {/* Placeholder tiles where incoming images will appear — one per
                  image still missing locally (remote total minus what's here),
                  shrinking as downloads stream in. Falls back to a small strip
                  when the platform exposes no remote total. */}
              {isSyncing && syncSkeletonCount > 0 && (
                <GallerySkeleton imageSize={imageSize} count={syncSkeletonCount} />
              )}
              <ImageGrid
              images={collection.assets}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
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
                deselect(id);
              }}
              layout={layout}
              imageSize={imageSize}
            />
            </>
          ) : isSyncing ? (
            /* Syncing empty state — skeleton grid where images will stream in */
            <GallerySkeleton
              imageSize={imageSize}
              count={expectedNew !== null && syncSkeletonCount > 0 ? syncSkeletonCount : 12}
            />
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
