"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function ImageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [image, setImage] = useState<ImageAsset | null>(null);
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [prompts, setPrompts] = useState<PromptWithVersions[]>([]);
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
    // Fetch image
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

    // Fetch tags
    const { data: tagsData } = await supabase
      .from("asset_tags")
      .select("*")
      .eq("asset_id", id)
      .order("confidence", { ascending: false });
    setTags(tagsData || []);

    // Fetch prompts with versions
    const { data: promptsData } = await supabase
      .from("prompts")
      .select(`
        *,
        versions:prompt_versions(*)
      `)
      .eq("asset_id", id)
      .order("created_at", { ascending: false });

    const promptsWithVersions = (promptsData || []) as PromptWithVersions[];
    setPrompts(promptsWithVersions);
    if (promptsWithVersions.length > 0) {
      setSelectedPrompt(promptsWithVersions[0]);
    }
  }

  async function handleCopy(text: string, id: string) {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
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
      // Create new version
      const newVersionIndex = (selectedPrompt.versions?.length || 0) + 1;
      
      await supabase.from("prompt_versions").insert({
        prompt_id: selectedPrompt.id,
        version_index: newVersionIndex,
        json_prompt: selectedPrompt.json_prompt,
        natural_prompt: editedPrompt,
        edit_source: "manual",
      });

      // Update main prompt
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
            <div className="animate-pulse text-white/40">Loading...</div>
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
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <Link href={`/playground?images=${id}`}>
                <Button>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Open in Playground
                </Button>
              </Link>
            </div>
          }
        />

        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Image preview */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="relative aspect-square overflow-hidden rounded-lg">
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Image info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Image Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Dimensions</span>
                    <span className="text-white">{image.width} × {image.height}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Format</span>
                    <span className="text-white">{image.format}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Source</span>
                    <Badge variant="secondary">{image.source_type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Added</span>
                    <span className="text-white">{formatDate(image.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Tags</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRetag}
                    disabled={isRetagging}
                  >
                    <RefreshCw className={cn("h-4 w-4", isRetagging && "animate-spin")} />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.tag}
                        {tag.confidence && (
                          <span className="ml-1 text-white/40">
                            {Math.round(tag.confidence * 100)}%
                          </span>
                        )}
                      </Badge>
                    ))}
                    {tags.length === 0 && (
                      <span className="text-sm text-white/40">No tags yet</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Prompts */}
            <div className="space-y-4">
              {/* Prompt selector */}
              {prompts.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {prompts.map((prompt, index) => (
                    <Button
                      key={prompt.id}
                      size="sm"
                      variant={selectedPrompt?.id === prompt.id ? "default" : "outline"}
                      onClick={() => setSelectedPrompt(prompt)}
                    >
                      Prompt {prompts.length - index}
                    </Button>
                  ))}
                </div>
              )}

              {selectedPrompt ? (
                <>
                  {/* Natural prompt */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4" />
                        Natural Prompt
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(selectedPrompt.natural_prompt, `natural-${selectedPrompt.id}`)}
                        >
                          {copiedId === `natural-${selectedPrompt.id}` ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsEditing(true);
                              setEditedPrompt(selectedPrompt.natural_prompt);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDeletePrompt(selectedPrompt.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <div className="space-y-3">
                          <Textarea
                            value={editedPrompt}
                            onChange={(e) => setEditedPrompt(e.target.value)}
                            rows={6}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsEditing(false)}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                          {selectedPrompt.natural_prompt}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* JSON prompt */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Code className="h-4 w-4" />
                        JSON Prompt
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowJson(!showJson)}
                        >
                          {showJson ? "Hide" : "Show"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleCopy(
                              JSON.stringify(selectedPrompt.json_prompt, null, 2),
                              `json-${selectedPrompt.id}`
                            )
                          }
                        >
                          {copiedId === `json-${selectedPrompt.id}` ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    {showJson && (
                      <CardContent>
                        <pre className="overflow-x-auto rounded-lg bg-black/50 p-4 text-xs text-white/80">
                          {JSON.stringify(selectedPrompt.json_prompt, null, 2)}
                        </pre>
                      </CardContent>
                    )}
                  </Card>

                  {/* Version history */}
                  {selectedPrompt.versions && selectedPrompt.versions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          Version History
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {selectedPrompt.versions
                            .sort((a, b) => b.version_index - a.version_index)
                            .map((version) => (
                              <div
                                key={version.id}
                                className="rounded-lg border border-white/10 p-3"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                      v{version.version_index}
                                    </Badge>
                                    <Badge variant="outline">{version.edit_source}</Badge>
                                  </div>
                                  <span className="text-xs text-white/40">
                                    {formatDate(version.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-white/60 line-clamp-2">
                                  {version.natural_prompt}
                                </p>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-white/40">No prompts generated yet</p>
                    <Button className="mt-4" onClick={handleRetag}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Prompt
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
