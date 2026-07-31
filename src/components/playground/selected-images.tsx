"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/supabase/client";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { ImageAsset, AssetTag, Prompt } from "@/lib/supabase/types";
import { Plus, X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageWithPrompt extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

// Layout constants: sidebar (256px) + panel content (340px) + toggle tab (24px) + gap (16px)
const PREVIEW_LEFT = 256 + 340 + 24 + 16;

interface SelectedImagesProps {
  images: ImageWithPrompt[];
  onAddClick: () => void;
  onRemoveImage: (id: string) => void;
  onInsertToken?: (text: string) => void;
}

// json_prompt structure (from VisionStruct):
// { composition: { camera_angle, depth_of_field, framing, focal_point },
//   global_context: { atmosphere, weather_atmosphere, time_of_day, lighting: { source, direction, quality, color_temp }, scene_description },
//   meta: { image_type }, color_palette: {...}, objects: [...] }
function extractJsonFields(json: unknown) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};

  const j = json as Record<string, unknown>;
  const composition = (typeof j.composition === "object" && j.composition ? j.composition : {}) as Record<string, unknown>;
  const globalCtx = (typeof j.global_context === "object" && j.global_context ? j.global_context : {}) as Record<string, unknown>;
  const lightingObj = (typeof globalCtx.lighting === "object" && globalCtx.lighting ? globalCtx.lighting : {}) as Record<string, unknown>;

  const str = (obj: Record<string, unknown>, key: string): string | undefined => {
    const v = obj[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  const lightingParts = [
    str(lightingObj, "source"),
    str(lightingObj, "quality"),
    str(lightingObj, "color_temp"),
    str(lightingObj, "direction"),
  ].filter(Boolean);

  return {
    camera_angle: str(composition, "camera_angle"),
    depth_of_field: str(composition, "depth_of_field"),
    framing: str(composition, "framing"),
    mood: str(globalCtx, "atmosphere") ?? str(globalCtx, "weather_atmosphere"),
    lighting: lightingParts.length ? lightingParts.join(" · ") : undefined,
    time_of_day: str(globalCtx, "time_of_day"),
    environment: str(globalCtx, "scene_description"),
  };
}

const META_LABELS: Record<string, string> = {
  camera_angle: "Camera",
  depth_of_field: "Depth of Field",
  framing: "Framing",
  mood: "Mood",
  lighting: "Lighting",
  time_of_day: "Time of Day",
  environment: "Environment",
};

// Which fields are long-form prose (rendered as paragraphs, not single-line values)
const PROSE_FIELDS = new Set(["environment"]);

export function SelectedImages({
  images,
  onAddClick,
  onRemoveImage,
  onInsertToken,
}: SelectedImagesProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewIndex = images.findIndex((img) => img.id === previewId);
  const previewImage = previewIndex >= 0 ? images[previewIndex] : null;

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (!previewImage || images.length < 2) return;
      const next = (previewIndex + dir + images.length) % images.length;
      setPreviewId(images[next].id);
    },
    [previewImage, previewIndex, images]
  );

  useEffect(() => {
    if (!previewImage) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "Escape") setPreviewId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewImage, navigate]);

  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">
            Selected Images
          </p>
          <Button size="sm" variant="ghost" onClick={onAddClick} className="h-6 w-6 p-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {images.length > 0 ? (
          <div>
            <div className="max-h-[296px] overflow-y-auto rounded-xl">
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, index) => {
                  const color = getImageColor(index);
                  const label = getImageLabel(index);

                  return (
                    <div
                      key={image.id}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-accent-faint"
                      onClick={() => setPreviewId(image.id)}
                    >
                      <Image
                        src={getThumbnailUrl(image.storage_path)}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                        sizes="140px"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                        <ZoomIn className="h-5 w-5 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
                      </div>
                      <div
                        className="absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                        style={{ backgroundColor: color.hex }}
                      >
                        {label}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveImage(image.id);
                        }}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onAddClick}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-strong py-2.5 text-xs text-tertiary transition-colors hover:border-strong hover:text-secondary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add more images
            </button>
          </div>
        ) : (
          <button
            onClick={onAddClick}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-strong py-6 text-tertiary transition-colors hover:border-strong hover:text-secondary"
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs">Click to select images</span>
          </button>
        )}
      </div>

      {previewImage && (
        <>
          {/* Dim backdrop (canvas area only) */}
          <div
            className="fixed inset-0 z-40 bg-black/10"
            style={{ left: PREVIEW_LEFT - 16 }}
            onClick={() => setPreviewId(null)}
          />

          {/* Preview card — 2-col: image left, metadata right */}
          <div
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-strong bg-surface shadow-2xl"
            style={{ left: PREVIEW_LEFT, top: 16, width: 720, bottom: 110 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: getImageColor(previewIndex).hex }}
                >
                  {getImageLabel(previewIndex)}
                </span>
                {images.length > 1 && (
                  <span className="text-[11px] text-tertiary">
                    {previewIndex + 1} / {images.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => navigate(-1)}
                      title="Previous (←)"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-accent-faint hover:text-secondary"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(1)}
                      title="Next (→)"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-accent-faint hover:text-secondary"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPreviewId(null)}
                  title="Close (Esc)"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-accent-faint hover:text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body — two columns */}
            <div className="flex min-h-0 flex-1">
              {/* Left: image */}
              <div className="relative w-[320px] shrink-0 bg-hover-soft">
                <Image
                  src={getThumbnailUrl(previewImage.storage_path)}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="320px"
                />
              </div>

              {/* Divider */}
              <div className="w-px shrink-0 bg-accent-faint" />

              {/* Right: metadata, scrollable */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <PreviewMetadata image={previewImage} onInsert={onInsertToken} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function InsertableText({
  text,
  prose = false,
  onInsert,
}: {
  text: string;
  prose?: boolean;
  onInsert?: (text: string) => void;
}) {
  if (!onInsert) {
    return prose ? (
      <p className="text-[11px] leading-relaxed text-secondary">{text}</p>
    ) : (
      <span className="text-[11px] leading-snug text-secondary">{text}</span>
    );
  }

  const cls = cn(
    "group/ins relative cursor-pointer rounded transition-colors",
    prose
      ? "block text-[11px] leading-relaxed text-secondary hover:bg-hover-soft -mx-1 px-1 py-0.5"
      : "inline text-[11px] leading-snug text-secondary hover:bg-hover-soft rounded px-0.5"
  );

  return (
    <span className={cls} onClick={() => onInsert(text)} title="Click to insert at cursor">
      {text}
      <span className="ml-1 inline-block translate-y-px rounded bg-accent-soft px-1 py-px text-[8px] font-medium text-tertiary opacity-0 transition-opacity group-hover/ins:opacity-100">
        insert
      </span>
    </span>
  );
}

function PreviewMetadata({
  image,
  onInsert,
}: {
  image: ImageWithPrompt;
  onInsert?: (text: string) => void;
}) {
  const prompt = image.prompts?.[0];
  if (!prompt) {
    return (
      <p className="px-4 py-4 text-xs italic text-tertiary">No prompt data available.</p>
    );
  }

  const naturalPrompt = prompt.natural_prompt?.trim();
  const fields = extractJsonFields(prompt.json_prompt);
  const fieldEntries = (Object.entries(fields) as [string, string | undefined][]).filter(
    (e): e is [string, string] => !!e[1]
  );

  return (
    <div className="divide-y divide-hairline">
      {/* Natural prompt */}
      {naturalPrompt && (
        <section className="px-4 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
            Natural Prompt
          </p>
          <InsertableText text={naturalPrompt} prose onInsert={onInsert} />
        </section>
      )}

      {/* Compact attribute rows */}
      {fieldEntries.length > 0 && (
        <section className="px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
            Analysis
          </p>
          <div className="space-y-2.5">
            {fieldEntries.map(([key, value]) =>
              PROSE_FIELDS.has(key) ? (
                <div key={key}>
                  <p className="mb-0.5 text-[10px] font-medium text-tertiary">
                    {META_LABELS[key] ?? key}
                  </p>
                  <InsertableText text={value} prose onInsert={onInsert} />
                </div>
              ) : (
                <div key={key} className="flex items-start gap-3">
                  <span className="w-[90px] shrink-0 pt-px text-[10px] font-medium text-tertiary">
                    {META_LABELS[key] ?? key}
                  </span>
                  <InsertableText text={value} onInsert={onInsert} />
                </div>
              )
            )}
          </div>
        </section>
      )}

      {!naturalPrompt && fieldEntries.length === 0 && (
        <p className="px-4 py-4 text-xs italic text-tertiary">No analysis data available.</p>
      )}
    </div>
  );
}
