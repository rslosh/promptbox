"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  Trash2,
  Pipette,
  Check,
} from "lucide-react";
import { supabase, getImageUrl, getThumbnailUrl } from "@/lib/supabase/client";
import { getGalleryNav } from "@/lib/gallery-nav";
import { cn, copyToClipboard } from "@/lib/utils";
import { ImageInspector } from "./image-inspector";

/** Notifies gallery pages so they can drop the card without a refetch. */
export function emitImageDeleted(id: string) {
  window.dispatchEvent(new CustomEvent("promptbox:image-deleted", { detail: { id } }));
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

/**
 * Full-screen viewer rendered by the intercepting @modal route, styled after
 * the GatherOS viewer: ambient backdrop from the image's own colors, a top
 * toolbar (counter · zoom · eyedropper · open · download · delete · close),
 * and the inspector Details panel on the right.
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
  const [fetched, setFetched] = useState<{
    storagePath: string;
    mediaType: "image" | "video";
  } | null>(null);
  const storagePath = entry?.storagePath ?? fetched?.storagePath ?? null;
  const isVideo = (entry?.mediaType ?? fetched?.mediaType) === "video";

  const [fullLoaded, setFullLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const stageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFullLoaded(false);
    setZoom(1);
    if (!entry) {
      supabase
        .from("image_assets")
        .select("storage_path, media_type")
        .eq("id", imageId)
        .single()
        .then(({ data }) =>
          setFetched(
            data
              ? {
                  storagePath: data.storage_path,
                  mediaType: (data.media_type as "image" | "video") ?? "image",
                }
              : null
          )
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  // Keep the viewport centered on the image's center as zoom changes —
  // without this the scroll container anchors to the top-left.
  useEffect(() => {
    const el = stageScrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);

  // Preload neighbor full-res images so arrow navigation is instant
  // (videos are streamed by the <video> element — nothing to preload here).
  useEffect(() => {
    [prev, next].forEach((n) => {
      if (n && n.mediaType !== "video") {
        const img = new window.Image();
        img.src = getImageUrl(n.storagePath);
      }
    });
  }, [prev, next]);

  function goTo(id: string) {
    // replace: keeps history to one entry so Back always closes the lightbox
    router.replace(`/image/${id}`, { scroll: false });
  }

  async function handleDownload() {
    if (!storagePath) return;
    try {
      const res = await fetch(getImageUrl(storagePath));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promptbox-${imageId.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  }

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      if (res.ok) {
        emitImageDeleted(imageId);
        if (next) goTo(next.id);
        else if (prev) goTo(prev.id);
        else router.back();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
    setIsDeleting(false);
  }

  async function handleEyedropper() {
    type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
    const EyeDropperApi = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!EyeDropperApi) return;
    try {
      const result = await new EyeDropperApi().open();
      await copyToClipboard(result.sRGBHex.toUpperCase());
      setPickedColor(result.sRGBHex.toUpperCase());
      setTimeout(() => setPickedColor(null), 2000);
    } catch {
      // user cancelled the picker
    }
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

  const toolbarBtn =
    "flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors duration-quick hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85">
      {/* Ambient backdrop: the image's own colors, blurred and dimmed */}
      {storagePath && (
        <div
          aria-hidden
          className="absolute inset-0 scale-125 bg-cover bg-center opacity-40 blur-[80px] saturate-150"
          style={{ backgroundImage: `url(${getThumbnailUrl(storagePath)})` }}
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-black/55" />

      {/* ── Toolbar ── */}
      <div className="relative z-20 flex h-titlebar shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className={toolbarBtn} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          {index >= 0 && (
            <span className="text-sm tabular-nums text-white/60">
              {index + 1} / {siblings.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom */}
          <span className="mr-1 w-10 text-right text-sm tabular-nums text-white/60">
            {Math.round(zoom * 100)}%
          </span>
          <input
            type="range"
            min={ZOOM_MIN * 100}
            max={ZOOM_MAX * 100}
            value={zoom * 100}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="h-1 w-28 cursor-pointer appearance-none rounded-pill bg-white/20 accent-white"
            aria-label="Zoom"
          />

          <div className="mx-2 h-4 w-px bg-white/15" />

          <button
            onClick={handleEyedropper}
            className={cn(toolbarBtn, "relative")}
            title="Pick a color (copies hex)"
          >
            {pickedColor ? <Check className="h-3.5 w-3.5" /> : <Pipette className="h-3.5 w-3.5" />}
          </button>
          {pickedColor && (
            <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/80">
              <span
                className="h-3 w-3 rounded-sm border border-white/30"
                style={{ backgroundColor: pickedColor }}
              />
              {pickedColor} copied
            </span>
          )}
          <a href={`/image/${imageId}`} className={toolbarBtn} title="Open full page">
            <Maximize2 className="h-3.5 w-3.5" />
          </a>
          <button onClick={handleDownload} className={toolbarBtn} title="Download">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(toolbarBtn, "hover:!bg-red-500/20 hover:!text-red-400")}
            title="Delete image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* Image stage */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          {/* Scrim click closes (only when not zoomed in) */}
          <div
            className="absolute inset-0"
            onClick={() => zoom === 1 && router.back()}
          />

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

          {storagePath && isVideo && (
            <div
              className="relative flex h-full w-full items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) router.back();
              }}
            >
              <video
                key={imageId}
                src={getImageUrl(storagePath)}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-full max-w-full rounded-lg"
              />
            </div>
          )}

          {storagePath && !isVideo && (
            <div
              ref={stageScrollRef}
              className="relative flex h-full w-full overflow-auto"
              onClick={(e) => {
                if (zoom <= 1 && e.target === e.currentTarget) router.back();
              }}
            >
              {/* m-auto centers when smaller than the stage and resolves to 0
                  when overflowing, so scrolling reaches every edge */}
              <div
                className="relative m-auto shrink-0"
                style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
              >
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
                  sizes={zoom > 1 ? "100vw" : "70vw"}
                  priority
                  onLoad={() => setFullLoaded(true)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Details panel */}
        <aside className="relative z-10 my-3 mr-3 hidden w-[400px] shrink-0 overflow-y-auto rounded-xl border border-white/10 bg-content p-4 shadow-modal md:block">
          <ImageInspector imageId={imageId} variant="modal" />
        </aside>
      </div>
    </div>
  );
}
