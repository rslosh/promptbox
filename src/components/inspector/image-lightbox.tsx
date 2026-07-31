"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { supabase, getImageUrl, getThumbnailUrl } from "@/lib/supabase/client";
import { getGalleryNav } from "@/lib/gallery-nav";
import { cn } from "@/lib/utils";
import { ImageInspector } from "./image-inspector";

/**
 * Full-screen viewer rendered by the intercepting @modal route. The gallery
 * stays mounted underneath — Esc/scrim/back all return without losing grid
 * state. Arrow keys move through the order captured by the last-rendered grid.
 *
 * Speed model: the storage path comes synchronously from the gallery-nav
 * store, the grid's already-cached thumbnail paints on the first frame, and
 * the full-res image fades in over it when loaded. Neighbors are preloaded
 * so arrow-keying is instant.
 */
export function ImageLightbox({ imageId }: { imageId: string }) {
  const router = useRouter();

  const siblings = getGalleryNav();
  const index = siblings.findIndex((e) => e.id === imageId);
  const entry = index >= 0 ? siblings[index] : null;
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  // Fallback for the rare case the store has no entry (e.g. a link from a
  // page that isn't a grid): fetch the path once.
  const [fetchedPath, setFetchedPath] = useState<string | null>(null);
  const storagePath = entry?.storagePath ?? fetchedPath;

  const [fullLoaded, setFullLoaded] = useState(false);

  useEffect(() => {
    setFullLoaded(false);
    if (!entry) {
      supabase
        .from("image_assets")
        .select("storage_path")
        .eq("id", imageId)
        .single()
        .then(({ data }) => setFetchedPath(data?.storage_path ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  // Preload neighbor full-res images so arrow navigation is instant
  useEffect(() => {
    [prev, next].forEach((n) => {
      if (n) {
        const img = new window.Image();
        img.src = getImageUrl(n.storagePath);
      }
    });
  }, [prev, next]);

  function goTo(id: string) {
    // replace: keeps history to one entry so Back always closes the lightbox
    router.replace(`/image/${id}`, { scroll: false });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        router.back();
      } else if (e.key === "ArrowLeft" && prev) {
        goTo(prev.id);
      } else if (e.key === "ArrowRight" && next) {
        goTo(next.id);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev, next]);

  // Lock body scroll while open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={() => router.back()}
      />

      {/* Image stage */}
      <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center p-8">
        {/* Close */}
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Open full page */}
        <a
          href={`/image/${imageId}`}
          className="absolute left-14 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
          title="Open full page"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </a>

        {/* Prev / Next */}
        {prev && (
          <button
            onClick={() => goTo(prev.id)}
            className="absolute left-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
        )}
        {next && (
          <button
            onClick={() => goTo(next.id)}
            className="absolute right-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
            aria-label="Next image"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        )}

        {storagePath && (
          <div className="relative h-full w-full">
            {/* Thumbnail: already in the browser cache from the grid — paints
                immediately and stays underneath until full-res arrives */}
            <Image
              src={getThumbnailUrl(storagePath)}
              alt=""
              fill
              className="object-contain"
              sizes="70vw"
              priority
            />
            <Image
              src={getImageUrl(storagePath)}
              alt=""
              fill
              className={cn(
                "object-contain transition-opacity duration-quick",
                fullLoaded ? "opacity-100" : "opacity-0"
              )}
              sizes="70vw"
              priority
              onLoad={() => setFullLoaded(true)}
            />
          </div>
        )}
      </div>

      {/* Inspector panel */}
      <aside className="relative z-10 hidden h-full w-[420px] shrink-0 overflow-y-auto border-l border-hairline bg-content p-4 md:block">
        <ImageInspector imageId={imageId} variant="modal" />
      </aside>
    </div>
  );
}
