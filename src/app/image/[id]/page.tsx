"use client";

import { useState, useEffect, use } from "react";
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
} from "lucide-react";

interface PromptWithVersions extends Prompt {
  versions: PromptVersion[];
}

interface CollectionRef {
  id: string;
  name: string;
  slug: string;
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
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    fetchImageDetails();
  }, [id]);

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
      .select("collection:collections(id, name, slug)")
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

  async function handleRetag() {
    setIsRetagging(true);
    try {
      await fetch("/api/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: id }),
      });
      await fetchImageDetails();
    } catch (error) {
      console.error("Retag error:", error);
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
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>
              </Link>
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
              <Panel className="overflow-hidden">
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
                  {collections.length > 0 && (
                    <div className="flex items-start justify-between gap-4 py-2.5">
                      <span className="text-xs text-gray-500">Collections</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {collections.map((c) => (
                          <Link key={c.id} href={`/collections/${c.slug}`}>
                            <Chip className="cursor-pointer hover:bg-black/[0.07] transition-colors">{c.name}</Chip>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <button
                    onClick={handleRetag}
                    disabled={isRetagging}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-700 disabled:opacity-40"
                    aria-label="Re-tag image"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRetagging && "animate-spin")} />
                  </button>
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
                          onClick={() => handleCopy(JSON.stringify(selectedPrompt.json_prompt, null, 2), `json-${selectedPrompt.id}`)}
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
                      <div className="p-5">
                        <pre className="overflow-x-auto rounded-lg border border-black/[0.06] bg-gray-50 p-4 text-xs text-gray-700">
                          {JSON.stringify(selectedPrompt.json_prompt, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Panel>

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
                  <Button className="mt-4" size="sm" onClick={handleRetag}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Generate Prompt
                  </Button>
                </Panel>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
