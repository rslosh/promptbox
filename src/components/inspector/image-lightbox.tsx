"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { supabase, getImageUrl } from "@/lib/supabase/client";
import { getGalleryNav } from "@/lib/gallery-nav";
import { ImageInspector } from "./image-inspector";

/**
 * Full-screen viewer rendered by the intercepting @modal route. The gallery
 * stays mounted underneath — Esc/scrim/back all return without losing grid
 * state. Arrow keys move through the order captured by the last-rendered grid.
 */
export function ImageLightbox({ imageId }: { imageId: string }) {
  const router = useRouter();
  const [storagePath, setStoragePath] = useState<string | null>(null);

  const siblings = getGalleryNav();
  const index = siblings.indexOf(imageId);
  const prevId = index > 0 ? siblings[index - 1] : null;
  const nextId = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  function goTo(id: string) {
    // replace: keeps history to one entry so Back always closes the lightbox
    router.replace(`/image/${id}`, { scroll: false });
  }

  useEffect(() => {
    supabase
      .from("image_assets")
      .select("storage_path")
      .eq("id", imageId)
      .single()
      .then(({ data }) => setStoragePath(data?.storage_path ?? null));
  }, [imageId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        router.back();
      } else if (e.key === "ArrowLeft" && prevId) {
        goTo(prevId);
      } else if (e.key === "ArrowRight" && nextId) {
        goTo(nextId);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevId, nextId]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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
          className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Open full page */}
        <a
          href={`/image/${imageId}`}
          className="absolute left-14 top-4 flex h-8 w-8 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
          title="Open full page"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </a>

        {/* Prev / Next */}
        {prevId && (
          <button
            onClick={() => goTo(prevId)}
            className="absolute left-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
        )}
        {nextId && (
          <button
            onClick={() => goTo(nextId)}
            className="absolute right-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-quick hover:bg-white/20 hover:text-white"
            aria-label="Next image"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        )}

        {storagePath && (
          <div className="relative h-full w-full">
            <Image
              src={getImageUrl(storagePath)}
              alt=""
              fill
              className="object-contain"
              sizes="70vw"
              placeholder="empty"
              priority
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
