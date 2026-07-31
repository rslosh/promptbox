"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { copyToClipboard, formatDate } from "@/lib/utils";
import { supabase, getImageUrl } from "@/lib/supabase/client";
import { reorderForDisplay } from "@/lib/tagger";
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
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [prompts, setPrompts] = useState<PromptWithVersions[]>([]);
  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptWithVersions | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRetagging, setIsRetagging] = useState(false);
  const [retagError, setRetagError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonView, setJsonView] = useState<"visstruct" | "ideogram">("ideogram");
  const [allCollections, setAllCollections] = useState<CollectionRef[]>([]);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // Reset per-image UI state when navigating between images inside the lightbox
    setImage(null);
    setSelectedPrompt(null);
    setIsEditing(false);
    setRetagError(null);
    setDimensions(null);
    fetchImageDetails();
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => setAllCollections(Array.isArray(data) ? data : []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

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
    const { data: imageData, error: imageError } = await supabase
      .from("image_assets")
      .select("*")
      .eq("id", imageId)
      .single();

    if (imageError || !imageData) {
      console.error("Error fetching image:", imageError);
      return;
    }
    setImage(imageData);

    const { data: tagsData } = await supabase
      .from("asset_tags")
      .select("*")
      .eq("asset_id", imageId)
      .order("confidence", { ascending: false });
    setTags(tagsData || []);

    const { data: promptsData } = await supabase
      .from("prompts")
      .select(`*, versions:prompt_versions(*)`)
      .eq("asset_id", imageId)
      .order("created_at", { ascending: false });

    const promptsWithVersions = (promptsData || []) as PromptWithVersions[];
    setPrompts(promptsWithVersions);
    if (promptsWithVersions.length > 0) {
      setSelectedPrompt(promptsWithVersions[0]);
    }

    const { data: collectionData } = await supabase
      .from("collection_assets")
      .select("collection:collections(id, name, slug, platform)")
      .eq("asset_id", imageId);

    setCollections(
      (collectionData || [])
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
    return (
      <div className="flex h-full items-center justify-center py-24">
        <div className="animate-pulse text-sm text-tertiary">Loading…</div>
      </div>
    );
  }

  const imageUrl = getImageUrl(image.storage_path);

  const actionBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Download
      </Button>
      <Link href={`/playground?images=${imageId}`}>
        <Button size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Open in Playground
        </Button>
      </Link>
    </div>
  );

  const infoPanel = (
    <Panel className="overflow-visible">
      <div className="border-b border-hairline px-5 py-3.5">
        <p className="text-sm font-medium text-primary">Image Info</p>
      </div>
      <div className="divide-y divide-hairline px-5">
        {dimensions && (
          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-tertiary">Dimensions</span>
            <span className="text-xs font-medium text-primary">{dimensions.w} × {dimensions.h}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-tertiary">Format</span>
          <span className="text-xs font-medium text-primary uppercase">{image.format}</span>
        </div>
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
    </Panel>
  );

  const tagsPanel = (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <p className="text-sm font-medium text-primary">Tags</p>
      </div>
      <div className="p-5">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Chip key={tag.id}>
                {tag.tag}
                {tag.confidence && (
                  <span className="text-tertiary">
                    {Math.round(tag.confidence * 100)}%
                  </span>
                )}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-tertiary">No tags yet</p>
        )}
      </div>
    </Panel>
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
          {prompts.map((prompt, index) => (
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
              Prompt {prompts.length - index}
            </button>
          ))}
        </div>
      )}

      {selectedPrompt ? (
        <>
          {/* Natural prompt */}
          <Panel className="overflow-hidden">
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
    return (
      <div className="space-y-4">
        {actionBar}
        {infoPanel}
        {tagsPanel}
        {promptsColumn}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ── Left column ── */}
      <div className="space-y-4">
        {/* Image preview */}
        <Panel className="overflow-hidden">
          <div className="relative aspect-square">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 50vw"
              onLoad={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                setDimensions({ w: el.naturalWidth, h: el.naturalHeight });
              }}
            />
          </div>
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
