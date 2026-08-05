"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { copyToClipboard, formatDate } from "@/lib/utils";
import { supabase, getImageUrl, getMediaThumbUrl } from "@/lib/supabase/client";
import { reorderForDisplay } from "@/lib/tagger";
import { VIDEO_CAPTION_STYLES } from "@/lib/video-analyzer";
import type { ImageAsset, AssetTag, Prompt, PromptVersion } from "@/lib/supabase/types";
import {
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Edit3,
  Save,
  X,
  Sparkles,
  Clock,
  Code,
  FileText,
  Download,
  Plus,
  Info,
  Loader2,
} from "lucide-react";

const PLATFORM_EMOJI: Record<string, string> = {
  pinterest: "📌",
  are_na: "🔲",
  tumblr: "📝",
  cosmos: "✦",
  shotdeck: "🎬",
  midjourney: "🌀",
  manual: "📁",
};

interface PromptWithVersions extends Prompt {
  versions: PromptVersion[];
}

interface CollectionRef {
  id: string;
  name: string;
  slug: string;
  platform: string;
}

/** Hex palette for the Details card — prefers the Ideogram (scene) palette,
    falls back to VisionStruct's dominant hex estimates. Already extracted by
    the tagging passes, so this costs nothing. */
function extractPalette(prompt: { scene_prompt: unknown; json_prompt: unknown } | null): string[] {
  if (!prompt) return [];
  const scene = prompt.scene_prompt as Record<string, unknown> | null;
  const style = scene?.style_description as Record<string, unknown> | undefined;
  const sceneColors = Array.isArray(style?.color_palette) ? style.color_palette : [];
  const json = prompt.json_prompt as Record<string, unknown> | null;
  const cp = json?.color_palette as Record<string, unknown> | undefined;
  const visColors = Array.isArray(cp?.dominant_hex_estimates) ? cp.dominant_hex_estimates : [];
  const hexes = [...sceneColors, ...visColors].filter(
    (c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)
  );
  return [...new Set(hexes.map((h) => h.toUpperCase()))].slice(0, 8);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function deriveSource(sourceType: string, sourceRef: string | null): string {
  if (sourceType === "upload") return "Direct upload";
  if (!sourceRef) return sourceType;
  try {
    const host = new URL(sourceRef).hostname.replace("www.", "");
    if (host.includes("pinterest.com")) return "Pinterest";
    if (host.includes("cosmos.so")) return "Cosmos";
    if (host.includes("are.na")) return "Are.na";
    if (host.includes("tumblr.com")) return "Tumblr";
    return host;
  } catch {
    return sourceRef;
  }
}

interface ImageInspectorProps {
  imageId: string;
  /** "page" renders the two-column layout with its own image preview;
      "modal" renders a single scrollable column (the lightbox shows the image). */
  variant: "page" | "modal";
}

export function ImageInspector({ imageId, variant }: ImageInspectorProps) {
  const [image, setImage] = useState<ImageAsset | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [prompts, setPrompts] = useState<PromptWithVersions[]>([]);
  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptWithVersions | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRetagging, setIsRetagging] = useState(false);
  const [retagError, setRetagError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(true);
  const [jsonView, setJsonView] = useState<"visstruct" | "ideogram">("ideogram");
  const [allCollections, setAllCollections] = useState<CollectionRef[]>([]);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Monotonic fetch id: fast arrow-keying can have several fetches in
  // flight — only the newest is allowed to write state.
  const fetchIdRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // The full collections list doesn't change per image — fetch once.
  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => setAllCollections(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Stale-while-loading: keep the previous image's panel rendered while
    // the next loads, then swap everything in a single render. Only editing
    // state resets immediately — it must not carry across images.
    setIsEditing(false);
    setRetagError(null);
    awaitingPromptRef.current = false;
    fetchImageDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  // A recent image with no prompts yet is almost certainly mid-auto-tag
  // (upload/sync fires /api/tag in the background). Poll until the prompt
  // lands so the panel fills itself in instead of sitting on an empty state.
  const AUTOTAG_WINDOW_MS = 15 * 60 * 1000;
  const isAutoTagging =
    !!image &&
    image.id === imageId &&
    prompts.length === 0 &&
    !isRetagging &&
    Date.now() - new Date(image.created_at).getTime() < AUTOTAG_WINDOW_MS;

  useEffect(() => {
    if (!isAutoTagging) return;
    const interval = setInterval(() => fetchImageDetails(), 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoTagging, imageId]);

  // Animate the prompt's arrival only when it just replaced the tagging
  // spinner — ordinary image-to-image navigation stays instant (it's a
  // high-frequency action and must not animate).
  const [justTagged, setJustTagged] = useState(false);
  const awaitingPromptRef = useRef(false);
  useEffect(() => {
    if (prompts.length === 0) {
      awaitingPromptRef.current = isAutoTagging;
      return;
    }
    if (awaitingPromptRef.current) {
      awaitingPromptRef.current = false;
      setJustTagged(true);
      const t = setTimeout(() => setJustTagged(false), 450);
      return () => clearTimeout(t);
    }
  }, [prompts.length, isAutoTagging]);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        addBtnRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setShowCollectionPicker(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handlePickerToggle() {
    if (showCollectionPicker) {
      setShowCollectionPicker(false);
      return;
    }
    const rect = addBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setPickerPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setShowCollectionPicker(true);
  }

  async function fetchImageDetails() {
    const fetchId = ++fetchIdRef.current;

    const [imageRes, tagsRes, promptsRes, collectionsRes] = await Promise.all([
      supabase.from("image_assets").select("*").eq("id", imageId).single(),
      supabase
        .from("asset_tags")
        .select("*")
        .eq("asset_id", imageId)
        .order("confidence", { ascending: false }),
      supabase
        .from("prompts")
        .select(`*, versions:prompt_versions(*)`)
        .eq("asset_id", imageId)
        .order("created_at", { ascending: false }),
      supabase
        .from("collection_assets")
        .select("collection:collections(id, name, slug, platform)")
        .eq("asset_id", imageId),
    ]);

    // A newer navigation superseded this fetch — drop it.
    if (fetchId !== fetchIdRef.current) return;

    if (imageRes.error || !imageRes.data) {
      console.error("Error fetching image:", imageRes.error);
      return;
    }

    const promptsWithVersions = (promptsRes.data || []) as PromptWithVersions[];

    // One synchronous block → React batches this into a single render:
    // the whole panel swaps at once instead of populating piecemeal.
    setImage(imageRes.data);
    setNameDraft(imageRes.data.name ?? "");
    setNoteDraft(imageRes.data.note ?? "");
    setTags(tagsRes.data || []);
    setPrompts(promptsWithVersions);
    setSelectedPrompt(promptsWithVersions[0] ?? null);
    setCollections(
      (collectionsRes.data || [])
        .map((row) => row.collection as unknown as CollectionRef | null)
        .filter((c): c is CollectionRef => c !== null)
    );
  }

  async function handleCopy(text: string, copyId: string) {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(copyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleDownload() {
    if (!image) return;
    try {
      const res = await fetch(getImageUrl(image.storage_path));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promptbox-${image.id.slice(0, 8)}.${image.format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  }

  async function handleRetag() {
    setIsRetagging(true);
    setRetagError(null);
    try {
      const stored = localStorage.getItem("promptbox_settings");
      const {
        geminiApiKey,
        geminiSystemPrompt,
        geminiProsePrompt,
        geminiScenePrompt,
        visionModel,
        proseModel,
        sceneModel,
      } = stored ? JSON.parse(stored) : {};
      const res = await fetch("/api/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: imageId,
          apiKey: geminiApiKey,
          systemPrompt: geminiSystemPrompt,
          prosePrompt: geminiProsePrompt,
          scenePrompt: geminiScenePrompt,
          visionModel,
          proseModel,
          sceneModel,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Tagging failed (${res.status})`);
      }
      await fetchImageDetails();
    } catch (error) {
      console.error("Retag error:", error);
      setRetagError(error instanceof Error ? error.message : "Tagging failed");
    }
    setIsRetagging(false);
  }

  async function handleSaveEdit() {
    if (!selectedPrompt) return;
    try {
      const newVersionIndex = (selectedPrompt.versions?.length || 0) + 1;
      await supabase.from("prompt_versions").insert({
        prompt_id: selectedPrompt.id,
        version_index: newVersionIndex,
        json_prompt: selectedPrompt.json_prompt,
        natural_prompt: editedPrompt,
        edit_source: "manual",
      });
      await supabase
        .from("prompts")
        .update({ natural_prompt: editedPrompt })
        .eq("id", selectedPrompt.id);
      setIsEditing(false);
      await fetchImageDetails();
    } catch (error) {
      console.error("Save error:", error);
    }
  }

  async function handleDeletePrompt(promptId: string) {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    try {
      await supabase.from("prompt_versions").delete().eq("prompt_id", promptId);
      await supabase.from("prompts").delete().eq("id", promptId);
      await fetchImageDetails();
    } catch (error) {
      console.error("Delete error:", error);
    }
  }

  // File size for the info tooltip — a HEAD request against storage
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    setFileSize(null);
    fetch(getImageUrl(image.storage_path), { method: "HEAD" })
      .then((r) => {
        const len = r.headers.get("content-length");
        if (!cancelled && len) setFileSize(Number(len));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [image?.storage_path]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveField(field: "name" | "note", value: string) {
    if (!image) return;
    const normalized = value.trim() || null;
    if (normalized === image[field]) return;
    setImage({ ...image, [field]: normalized });
    await supabase.from("image_assets").update({ [field]: normalized }).eq("id", imageId);
  }

  async function handleAddToCollection(collectionId: string) {
    setShowCollectionPicker(false);
    await fetch(`/api/collections/${collectionId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_ids: [imageId] }),
    });
    const added = allCollections.find((c) => c.id === collectionId);
    if (added) setCollections((prev) => [...prev, added]);
  }

  async function handleRemoveFromCollection(collectionId: string) {
    await fetch(`/api/collections/${collectionId}/assets`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: imageId }),
    });
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
  }

  if (!image) {
    // Only shown on the very first open — subsequent navigations keep the
    // previous panel visible until the new data swaps in atomically.
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-md bg-accent-faint" />
          <div className="h-8 w-40 rounded-pill bg-accent-faint" />
        </div>
        <div className="h-48 rounded-xl bg-accent-faint" />
        <div className="h-32 rounded-xl bg-accent-faint" />
        <div className="h-24 rounded-xl bg-accent-faint" />
      </div>
    );
  }

  const imageUrl = getImageUrl(image.storage_path);

  // Selector shows oldest-first so labels read Prompt 1 → Prompt 2 left to
  // right. Video captions are labeled by their style instead of a number.
  const displayPrompts = [...prompts].reverse();
  function promptLabel(prompt: PromptWithVersions, index: number): string {
    const style = (prompt.model_params as { style?: string } | null)?.style;
    const styleMeta = VIDEO_CAPTION_STYLES.find((s) => s.key === style);
    if (styleMeta) return styleMeta.label;
    return `Prompt ${index + 1}`;
  }

  const actionBar = (
    <div className="flex flex-wrap items-center gap-2">
      {variant === "page" && (
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download
        </Button>
      )}
      <Link href={`/playground?images=${imageId}`}>
        <Button size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Open in Playground
        </Button>
      </Link>
    </div>
  );

  const palette = extractPalette(selectedPrompt);

  const detailsHeader = (
    <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
      <p className="text-sm font-medium text-primary">Details</p>
      <div className="group/info relative">
        <button
          aria-label="Image information"
          className="flex h-6 w-6 items-center justify-center rounded-pill text-tertiary transition-colors duration-quick hover:bg-hover-soft hover:text-primary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <div className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 w-56 space-y-2 rounded-lg border border-hairline bg-surface p-3.5 opacity-0 shadow-modal transition-opacity duration-quick group-hover/info:opacity-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-tertiary">Saved</span>
            <span className="text-xs font-medium text-primary">{formatDate(image.created_at)}</span>
          </div>
          {image.width > 0 && image.height > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary">Dimensions</span>
              <span className="text-xs font-medium text-primary">
                {image.width} × {image.height}
              </span>
            </div>
          )}
          {fileSize !== null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary">Size</span>
              <span className="text-xs font-medium text-primary">{formatBytes(fileSize)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const detailsFields = (
    <div className="space-y-3 px-5 py-4">
        {/* Thumbnail preview with format badge — the lightbox stage already
            shows the image, so this is the panel's identity card */}
        {variant === "modal" && (
          <div className="relative overflow-hidden rounded-lg border border-hairline bg-hover-soft">
            <div className="relative aspect-[4/3]">
              <Image
                src={getMediaThumbUrl(image)}
                alt=""
                fill
                className="object-cover"
                sizes="360px"
              />
            </div>
            <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              {image.media_type === "video" ? `${image.format} · video` : image.format}
            </span>
          </div>
        )}

        {/* Palette — extracted by the tagging passes; click to copy */}
        {palette.length > 0 && (
          <div className="flex items-center gap-1.5">
            {palette.map((hex) => (
              <button
                key={hex}
                onClick={() => handleCopy(hex, `hex-${hex}`)}
                title={`${hex} — click to copy`}
                className="group/swatch relative h-5 w-5 rounded-pill border border-hairline transition-transform duration-quick hover:scale-110"
                style={{ backgroundColor: hex }}
              >
                {copiedId === `hex-${hex}` && (
                  <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="mb-1 block text-xs text-tertiary">Name</label>
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => saveField("name", nameDraft)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Untitled"
          />
        </div>

        {/* Source URL */}
        {image.source_ref && (
          <div>
            <label className="mb-1 block text-xs text-tertiary">URL</label>
            <a
              href={image.source_ref}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate rounded-md border border-input bg-input-bg px-2.5 py-1.5 text-sm text-secondary transition-colors duration-quick hover:text-primary"
            >
              {image.source_ref}
            </a>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="mb-1 block text-xs text-tertiary">Note</label>
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => saveField("note", noteDraft)}
            placeholder="Add a note…"
            className="min-h-[56px]"
            rows={2}
          />
        </div>
    </div>
  );

  const metaRows = (
    <div className="divide-y divide-hairline border-t border-hairline px-5">
        {image.width > 0 && image.height > 0 && (
          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-tertiary">Dimensions</span>
            <span className="text-xs font-medium text-primary">{image.width} × {image.height}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-tertiary">Source</span>
          <Chip>{deriveSource(image.source_type, image.source_ref)}</Chip>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <span className="text-xs text-tertiary">Collections</span>
          <div className="flex flex-wrap justify-end gap-1">
            {collections.map((c) => (
              <div key={c.id} className="group flex items-center gap-0.5 rounded-full border border-hairline bg-hover-soft py-0.5 pl-2 pr-1 transition-colors hover:border-strong">
                <Link
                  href={`/collections/${c.slug}`}
                  className="text-[11px] text-secondary transition-colors hover:text-primary"
                >
                  {c.name}
                </Link>
                <button
                  onClick={() => handleRemoveFromCollection(c.id)}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-icon-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-accent-faint hover:text-secondary"
                  title="Remove from collection"
                >
                  <X className="h-2 w-2" />
                </button>
              </div>
            ))}

            {/* Add to collection picker */}
            <button
              ref={addBtnRef}
              onClick={handlePickerToggle}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                showCollectionPicker
                  ? "border-accent bg-accent text-on-accent"
                  : "border-strong bg-accent-faint text-secondary hover:border-strong hover:bg-accent-soft hover:text-primary"
              )}
            >
              <Plus className="h-3 w-3" />
              Add to collection
            </button>

            {/* Dropdown portaled to body to escape stacking contexts */}
            {mounted && showCollectionPicker && pickerPos && createPortal(
              <div
                ref={dropdownRef}
                style={{ top: pickerPos.top, right: pickerPos.right }}
                className="fixed z-[9999] w-56 rounded-xl border border-hairline bg-surface shadow-modal"
              >
                {allCollections.filter((c) => !collections.some((ec) => ec.id === c.id)).length === 0 ? (
                  <p className="px-4 py-3 text-xs text-tertiary">All collections added</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto py-1.5">
                    {allCollections
                      .filter((c) => !collections.some((ec) => ec.id === c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleAddToCollection(c.id)}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs text-secondary transition-colors hover:bg-hover-soft"
                        >
                          <span>{PLATFORM_EMOJI[c.platform] ?? "📁"}</span>
                          <span className="truncate font-medium">{c.name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-tertiary">Added</span>
          <span className="text-xs text-secondary">{formatDate(image.created_at)}</span>
        </div>
    </div>
  );

  const infoPanel = (
    <Panel className="overflow-visible">
      {detailsHeader}
      {detailsFields}
      {metaRows}
    </Panel>
  );

  const tagsChips =
    tags.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Chip key={tag.id}>
            {tag.tag}
            {tag.confidence && (
              <span className="text-tertiary">{Math.round(tag.confidence * 100)}%</span>
            )}
          </Chip>
        ))}
      </div>
    ) : (
      <p className="text-sm text-tertiary">No tags yet</p>
    );

  const autoTagButton = (
    <button
      onClick={handleRetag}
      disabled={isRetagging}
      className="flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-secondary transition-colors duration-quick hover:bg-hover-soft hover:text-primary disabled:opacity-40"
      title="Re-run auto-tagging on this image"
    >
      {isRetagging ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      Auto-tag
    </button>
  );

  const tagsPanel = (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <p className="text-sm font-medium text-primary">Tags</p>
        {autoTagButton}
      </div>
      <div className="p-5">{tagsChips}</div>
    </Panel>
  );

  // Modal-only: prompts folded into the Details card as an "Image Prompt"
  // section, GatherOS-style, instead of separate stacked panels.
  const scenePromptJson = selectedPrompt?.scene_prompt as Record<string, unknown> | null;
  const hasSceneJson = !!scenePromptJson && Object.keys(scenePromptJson).length > 0;
  const activeJsonView = hasSceneJson ? jsonView : "visstruct";
  const activeJsonText = selectedPrompt
    ? JSON.stringify(
        activeJsonView === "ideogram"
          ? scenePromptJson
          : reorderForDisplay(selectedPrompt.json_prompt as Record<string, unknown>),
        null,
        2
      )
    : "";

  const promptSection = (
    <div className="border-t border-hairline">
      <div className="flex items-center justify-between px-5 py-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5 text-tertiary" />
          Image Prompt
        </p>
        {selectedPrompt && (
          <button
            onClick={handleRetag}
            disabled={isRetagging}
            className="flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-secondary transition-colors duration-quick hover:bg-hover-soft hover:text-primary disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", isRetagging && "animate-spin")} />
            {isRetagging ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>
      <div className="space-y-3 px-5 pb-4">
        {retagError && <p className="text-xs text-error">{retagError}</p>}

        {prompts.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {displayPrompts.map((prompt, index) => (
              <button
                key={prompt.id}
                onClick={() => setSelectedPrompt(prompt)}
                className={cn(
                  "flex h-7 shrink-0 items-center rounded-md border px-2.5 text-xs font-medium transition-colors",
                  selectedPrompt?.id === prompt.id
                    ? "border-accent bg-accent text-on-accent"
                    : "border-input text-secondary hover:border-strong hover:text-primary"
                )}
              >
                {promptLabel(prompt, index)}
              </button>
            ))}
          </div>
        )}

        {selectedPrompt ? (
          <>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={6}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-md border border-hairline bg-hover-soft p-3",
                  justTagged && "animate-enter"
                )}
              >
                {/* Actions live above the text — long captions (videos)
                    shouldn't require scrolling to reach Copy */}
                <div className="mb-2 flex items-center gap-0.5 border-b border-hairline pb-2">
                  <button
                    onClick={() =>
                      handleCopy(selectedPrompt.natural_prompt, `natural-${selectedPrompt.id}`)
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-soft hover:text-secondary"
                    aria-label="Copy prompt"
                  >
                    {copiedId === `natural-${selectedPrompt.id}` ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditedPrompt(selectedPrompt.natural_prompt);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-soft hover:text-secondary"
                    aria-label="Edit prompt"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(selectedPrompt.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-error/10 hover:text-error"
                    aria-label="Delete prompt"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                  {selectedPrompt.natural_prompt}
                </p>
              </div>
            )}

            {/* JSON */}
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                <Code className="h-3 w-3 text-tertiary" />
                JSON
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="flex h-6 items-center rounded-md px-2 text-xs font-medium text-secondary transition-colors hover:bg-hover-soft hover:text-primary"
                >
                  {showJson ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => handleCopy(activeJsonText, `json-${selectedPrompt.id}`)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-soft hover:text-secondary"
                  aria-label="Copy JSON"
                >
                  {copiedId === `json-${selectedPrompt.id}` ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
            {showJson && (
              <div className="space-y-2">
                {hasSceneJson && (
                  <div className="inline-flex rounded-md border border-hairline bg-hover-soft p-0.5">
                    {[
                      { key: "ideogram" as const, label: "Ideogram" },
                      { key: "visstruct" as const, label: "VisStruct" },
                    ].map((view) => (
                      <button
                        key={view.key}
                        onClick={() => setJsonView(view.key)}
                        className={cn(
                          "flex h-6 items-center rounded-sm px-2.5 text-xs font-medium transition-colors",
                          activeJsonView === view.key
                            ? "bg-surface text-primary shadow-sm"
                            : "text-tertiary hover:text-primary"
                        )}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                )}
                <pre className="max-h-64 overflow-auto rounded-md border border-hairline bg-hover-soft p-3 text-xs text-secondary">
                  {activeJsonText}
                </pre>
              </div>
            )}

            {/* Version history */}
            {selectedPrompt.versions && selectedPrompt.versions.length > 0 && (
              <div>
                <button
                  onClick={() => setShowVersions((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-tertiary transition-colors hover:text-secondary"
                >
                  <Clock className="h-3 w-3" />
                  Version history ({selectedPrompt.versions.length})
                </button>
                {showVersions && (
                  <div className="mt-2 divide-y divide-hairline rounded-md border border-hairline">
                    {selectedPrompt.versions
                      .sort((a, b) => b.version_index - a.version_index)
                      .map((version) => (
                        <div key={version.id} className="p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Chip>v{version.version_index}</Chip>
                              <Chip>{version.edit_source}</Chip>
                            </div>
                            <span className="text-xs text-tertiary">
                              {formatDate(version.created_at)}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-secondary">
                            {version.natural_prompt}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : isAutoTagging ? (
          <div className="animate-enter flex items-center gap-2.5 rounded-md border border-hairline bg-hover-soft p-3">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-secondary" />
            <div>
              <p className="text-xs font-medium text-primary">Generating prompt…</p>
              <p className="text-xs text-tertiary">
                Auto-tagging with Gemini — usually under a minute
              </p>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={handleRetag} disabled={isRetagging}>
            {isRetagging ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRetagging ? "Generating…" : "Generate prompt"}
          </Button>
        )}
      </div>
    </div>
  );

  const tagsSection = (
    <div className="border-t border-hairline">
      <div className="flex items-center justify-between px-5 py-3.5">
        <p className="text-sm font-medium text-primary">Tags</p>
        {autoTagButton}
      </div>
      <div className="px-5 pb-4">{tagsChips}</div>
    </div>
  );

  const promptsColumn = (
    <div className="space-y-4">
      {/* Prompts header — always visible when at least one prompt exists */}
      {prompts.length > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Prompts</p>
            {retagError && (
              <p className="mt-1 text-xs text-error">{retagError}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetag}
            disabled={isRetagging}
          >
            {isRetagging ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRetagging ? "Regenerating…" : "Regenerate prompt"}
          </Button>
        </div>
      )}

      {/* Prompt selector (multiple prompts) */}
      {prompts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayPrompts.map((prompt, index) => (
            <button
              key={prompt.id}
              onClick={() => setSelectedPrompt(prompt)}
              className={cn(
                "flex h-8 shrink-0 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
                selectedPrompt?.id === prompt.id
                  ? "border-accent bg-accent text-on-accent"
                  : "border-input text-secondary hover:border-strong hover:text-primary"
              )}
            >
              {promptLabel(prompt, index)}
            </button>
          ))}
        </div>
      )}

      {selectedPrompt ? (
        <>
          {/* Natural prompt */}
          <Panel className={cn("overflow-hidden", justTagged && "animate-enter")}>
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <FileText className="h-3.5 w-3.5 text-tertiary" />
                Natural Prompt
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => handleCopy(selectedPrompt.natural_prompt, `natural-${selectedPrompt.id}`)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-soft hover:text-secondary"
                  aria-label="Copy prompt"
                >
                  {copiedId === `natural-${selectedPrompt.id}` ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                {!isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditedPrompt(selectedPrompt.natural_prompt);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-soft hover:text-secondary"
                    aria-label="Edit prompt"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDeletePrompt(selectedPrompt.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-error/10 hover:text-error"
                  aria-label="Delete prompt"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    rows={6}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-secondary whitespace-pre-wrap">
                  {selectedPrompt.natural_prompt}
                </p>
              )}
            </div>
          </Panel>

          {/* JSON prompt */}
          {(() => {
            const scenePrompt = selectedPrompt.scene_prompt as Record<string, unknown> | null;
            const hasScene = !!scenePrompt && Object.keys(scenePrompt).length > 0;
            const activeView = hasScene ? jsonView : "visstruct";
            const activeJson =
              activeView === "ideogram"
                ? scenePrompt!
                : reorderForDisplay(selectedPrompt.json_prompt as Record<string, unknown>);
            const activeJsonText = JSON.stringify(activeJson, null, 2);
            return (
              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
                  <p className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Code className="h-3.5 w-3.5 text-tertiary" />
                    JSON Prompt
                  </p>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setShowJson(!showJson)}
                      className="flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-secondary transition-colors hover:bg-hover-soft hover:text-primary"
                    >
                      {showJson ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleCopy(activeJsonText, `json-${selectedPrompt.id}`)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-soft hover:text-secondary"
                      aria-label="Copy JSON"
                    >
                      {copiedId === `json-${selectedPrompt.id}` ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                {showJson && (
                  <div className="space-y-3 p-5">
                    {hasScene && (
                      <div className="inline-flex rounded-lg border border-hairline bg-hover-soft p-0.5">
                        {[
                          { key: "ideogram" as const, label: "Ideogram" },
                          { key: "visstruct" as const, label: "VisStruct" },
                        ].map((view) => (
                          <button
                            key={view.key}
                            onClick={() => setJsonView(view.key)}
                            className={`flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors ${
                              activeView === view.key
                                ? "bg-surface text-primary shadow-sm"
                                : "text-tertiary hover:text-primary"
                            }`}
                          >
                            {view.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <pre className="overflow-x-auto rounded-lg border border-hairline bg-hover-soft p-4 text-xs text-secondary">
                      {activeJsonText}
                    </pre>
                  </div>
                )}
              </Panel>
            );
          })()}

          {/* Version history */}
          {selectedPrompt.versions && selectedPrompt.versions.length > 0 && (
            <Panel className="overflow-hidden">
              <div className="border-b border-hairline px-5 py-3.5">
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Clock className="h-3.5 w-3.5 text-tertiary" />
                  Version History
                </p>
              </div>
              <div className="divide-y divide-hairline px-5">
                {selectedPrompt.versions
                  .sort((a, b) => b.version_index - a.version_index)
                  .map((version) => (
                    <div key={version.id} className="py-3.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Chip>v{version.version_index}</Chip>
                          <Chip>{version.edit_source}</Chip>
                        </div>
                        <span className="text-xs text-tertiary">
                          {formatDate(version.created_at)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-secondary line-clamp-2">
                        {version.natural_prompt}
                      </p>
                    </div>
                  ))}
              </div>
            </Panel>
          )}
        </>
      ) : isAutoTagging ? (
        <Panel className="animate-enter py-14 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-secondary" />
          <p className="mt-3 text-sm font-medium text-primary">Generating prompts…</p>
          <p className="mt-1 text-xs text-tertiary">
            Auto-tagging runs in the background after upload — this usually takes under a minute
          </p>
        </Panel>
      ) : (
        <Panel className="py-14 text-center">
          <p className="text-sm text-tertiary">No prompts generated yet</p>
          <Button
            className="mt-4"
            size="sm"
            onClick={handleRetag}
            disabled={isRetagging}
          >
            {isRetagging ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRetagging ? "Generating…" : "Generate Prompt"}
          </Button>
          {retagError && (
            <p className="mt-3 text-xs text-error">{retagError}</p>
          )}
        </Panel>
      )}
    </div>
  );

  if (variant === "modal") {
    // One continuous Details card, GatherOS-style: identity → fields →
    // Image Prompt → metadata → Tags.
    return (
      <div className="space-y-3">
        {actionBar}
        <Panel className="overflow-visible">
          {detailsHeader}
          {detailsFields}
          {promptSection}
          {metaRows}
          {tagsSection}
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ── Left column ── */}
      <div className="space-y-4">
        {/* Media preview */}
        <Panel className="overflow-hidden">
          {image.media_type === "video" ? (
            <video
              src={imageUrl}
              controls
              playsInline
              className="aspect-square w-full bg-black object-contain"
            />
          ) : (
            <div className="relative aspect-square">
              <Image
                src={imageUrl}
                alt=""
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          )}
        </Panel>

        {actionBar}
        {infoPanel}
        {tagsPanel}
      </div>

      {/* ── Right column ── */}
      {promptsColumn}
    </div>
  );
}
