"use client";

import { useState, useEffect, useRef, use } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
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
  ArrowLeft,
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

export default function ImageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
    fetchImageDetails();
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => setAllCollections(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [id]);

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
      .eq("id", id)
      .single();

    if (imageError || !imageData) {
      console.error("Error fetching image:", imageError);
      return;
    }
    setImage(imageData);

    const { data: tagsData } = await supabase
      .from("asset_tags")
      .select("*")
      .eq("asset_id", id)
      .order("confidence", { ascending: false });
    setTags(tagsData || []);

    const { data: promptsData } = await supabase
      .from("prompts")
      .select(`*, versions:prompt_versions(*)`)
      .eq("asset_id", id)
      .order("created_at", { ascending: false });

    const promptsWithVersions = (promptsData || []) as PromptWithVersions[];
    setPrompts(promptsWithVersions);
    if (promptsWithVersions.length > 0) {
      setSelectedPrompt(promptsWithVersions[0]);
    }

    const { data: collectionData } = await supabase
      .from("collection_assets")
      .select("collection:collections(id, name, slug, platform)")
      .eq("asset_id", id);

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
      const res = await fetch(imageUrl);
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
          assetId: id,
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
      body: JSON.stringify({ asset_ids: [id] }),
    });
    const added = allCollections.find((c) => c.id === collectionId);
    if (added) setCollections((prev) => [...prev, added]);
  }

  async function handleRemoveFromCollection(collectionId: string) {
    await fetch(`/api/collections/${collectionId}/assets`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: id }),
    });
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
  }

  if (!image) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-64">
          <div className="flex h-full items-center justify-center">
            <div className="animate-pulse text-sm text-gray-400">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  const imageUrl = getImageUrl(image.storage_path);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header
          title="Image Details"
          actions={
            <div className="flex gap-2">
              {/* scroll={false}: let the gallery restore its own scroll
                  position on return instead of Next jumping to the top. */}
              <Link href="/" scroll={false}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </Button>
              <Link href={`/playground?images=${id}`}>
                <Button size="sm">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Open in Playground
                </Button>
              </Link>
            </div>
          }
        />

        <div className="p-6">
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

              {/* Image info */}
              <Panel className="overflow-visible">
                <div className="border-b border-black/[0.06] px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-800">Image Info</p>
                </div>
                <div className="divide-y divide-black/[0.05] px-5">
                  {dimensions && (
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-xs text-gray-500">Dimensions</span>
                      <span className="text-xs font-medium text-gray-800">{dimensions.w} × {dimensions.h}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Format</span>
                    <span className="text-xs font-medium text-gray-800 uppercase">{image.format}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Source</span>
                    <Chip>{deriveSource(image.source_type, image.source_ref)}</Chip>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-2.5">
                    <span className="text-xs text-gray-500">Collections</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {collections.map((c) => (
                        <div key={c.id} className="group flex items-center gap-0.5 rounded-full border border-black/[0.08] bg-black/[0.03] py-0.5 pl-2 pr-1 transition-colors hover:border-black/[0.14]">
                          <Link
                            href={`/collections/${c.slug}`}
                            className="text-[11px] text-gray-600 transition-colors hover:text-gray-900"
                          >
                            {c.name}
                          </Link>
                          <button
                            onClick={() => handleRemoveFromCollection(c.id)}
                            className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-black/[0.06] hover:text-gray-600"
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
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-black/[0.12] bg-gray-100 text-gray-600 hover:border-black/[0.2] hover:bg-gray-200 hover:text-gray-800"
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
                          className="fixed z-[9999] w-56 rounded-xl border border-black/[0.08] bg-white shadow-xl"
                        >
                          {allCollections.filter((c) => !collections.some((ec) => ec.id === c.id)).length === 0 ? (
                            <p className="px-4 py-3 text-xs text-gray-400">All collections added</p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto py-1.5">
                              {allCollections
                                .filter((c) => !collections.some((ec) => ec.id === c.id))
                                .map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => handleAddToCollection(c.id)}
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs text-gray-700 transition-colors hover:bg-gray-50"
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
                    <span className="text-xs text-gray-500">Added</span>
                    <span className="text-xs text-gray-700">{formatDate(image.created_at)}</span>
                  </div>
                </div>
              </Panel>

              {/* Tags */}
              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-800">Tags</p>
                </div>
                <div className="p-5">
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Chip key={tag.id}>
                          {tag.tag}
                          {tag.confidence && (
                            <span className="text-gray-400">
                              {Math.round(tag.confidence * 100)}%
                            </span>
                          )}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No tags yet</p>
                  )}
                </div>
              </Panel>
            </div>

            {/* ── Right column ── */}
            <div className="space-y-4">

              {/* Prompts header — always visible when at least one prompt exists */}
              {prompts.length > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Prompts</p>
                    {retagError && (
                      <p className="mt-1 text-xs text-red-600">{retagError}</p>
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
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-black/[0.1] text-gray-600 hover:border-black/[0.2] hover:text-gray-800"
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
                    <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
                      <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
                        <FileText className="h-3.5 w-3.5 text-gray-500" />
                        Natural Prompt
                      </p>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleCopy(selectedPrompt.natural_prompt, `natural-${selectedPrompt.id}`)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-700"
                          aria-label="Copy prompt"
                        >
                          {copiedId === `natural-${selectedPrompt.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
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
                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-700"
                            aria-label="Edit prompt"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePrompt(selectedPrompt.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
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
                        <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
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
                        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
                          <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
                            <Code className="h-3.5 w-3.5 text-gray-500" />
                            JSON Prompt
                          </p>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setShowJson(!showJson)}
                              className="flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-800"
                            >
                              {showJson ? "Hide" : "Show"}
                            </button>
                            <button
                              onClick={() => handleCopy(activeJsonText, `json-${selectedPrompt.id}`)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-700"
                              aria-label="Copy JSON"
                            >
                              {copiedId === `json-${selectedPrompt.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        {showJson && (
                          <div className="space-y-3 p-5">
                            {hasScene && (
                              <div className="inline-flex rounded-lg border border-black/[0.06] bg-gray-50 p-0.5">
                                {[
                                  { key: "ideogram" as const, label: "Ideogram" },
                                  { key: "visstruct" as const, label: "VisStruct" },
                                ].map((view) => (
                                  <button
                                    key={view.key}
                                    onClick={() => setJsonView(view.key)}
                                    className={`flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors ${
                                      activeView === view.key
                                        ? "bg-white text-gray-800 shadow-sm"
                                        : "text-gray-500 hover:text-gray-800"
                                    }`}
                                  >
                                    {view.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <pre className="overflow-x-auto rounded-lg border border-black/[0.06] bg-gray-50 p-4 text-xs text-gray-700">
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
                      <div className="border-b border-black/[0.06] px-5 py-3.5">
                        <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
                          <Clock className="h-3.5 w-3.5 text-gray-500" />
                          Version History
                        </p>
                      </div>
                      <div className="divide-y divide-black/[0.05] px-5">
                        {selectedPrompt.versions
                          .sort((a, b) => b.version_index - a.version_index)
                          .map((version) => (
                            <div key={version.id} className="py-3.5">
                              <div className="mb-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Chip>v{version.version_index}</Chip>
                                  <Chip>{version.edit_source}</Chip>
                                </div>
                                <span className="text-xs text-gray-400">
                                  {formatDate(version.created_at)}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed text-gray-600 line-clamp-2">
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
                  <p className="text-sm text-gray-400">No prompts generated yet</p>
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
                    <p className="mt-3 text-xs text-red-600">{retagError}</p>
                  )}
                </Panel>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
