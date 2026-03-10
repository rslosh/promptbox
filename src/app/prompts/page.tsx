"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { EmptyState } from "@/components/ui/empty-state";
import { copyToClipboard, formatRelativeTime } from "@/lib/utils";
import { supabase, getThumbnailUrl } from "@/lib/supabase/client";
import type { PromptLibrary } from "@/lib/supabase/types";
import {
  BookOpen,
  Plus,
  Star,
  Copy,
  Pencil,
  Check,
  Search,
  X,
  Link2,
  Loader2,
  ImagePlus,
  Sparkles,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Type config ───────────────────────────────────────────────────────────────

type PromptType = "image_gen" | "image_edit" | "video_gen";

const TYPE_CONFIG: Record<
  PromptType,
  { label: string; badge: string; placeholder: string; symbol: string }
> = {
  image_gen: {
    label: "Image Gen",
    badge: "bg-amber-500/85 text-white",
    placeholder: "from-amber-100 via-orange-50 to-amber-50",
    symbol: "✦",
  },
  image_edit: {
    label: "Image Edit",
    badge: "bg-violet-500/85 text-white",
    placeholder: "from-violet-100 via-purple-50 to-violet-50",
    symbol: "◈",
  },
  video_gen: {
    label: "Video Gen",
    badge: "bg-cyan-500/85 text-white",
    placeholder: "from-cyan-100 via-sky-50 to-cyan-50",
    symbol: "▷",
  },
};

// ── Prompt card ───────────────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: PromptLibrary;
  allImages: Map<string, string>;
  onFavoriteToggle: (id: string, value: boolean) => void;
  onEdit: (prompt: PromptLibrary) => void;
  onDelete: (id: string) => void;
}

function PromptCard({ prompt, allImages, onFavoriteToggle, onEdit, onDelete }: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cfg = TYPE_CONFIG[prompt.type];

  // Pick display image: output image > first source image > null
  const displayPath = prompt.output_image_id
    ? allImages.get(prompt.output_image_id)
    : prompt.source_image_ids[0]
    ? allImages.get(prompt.source_image_ids[0])
    : undefined;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await copyToClipboard(prompt.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="group relative cursor-default select-none">
      {/* ── Image card ── */}
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-black/[0.07] bg-gray-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md">
        {/* Background */}
        {displayPath ? (
          <img
            src={getThumbnailUrl(displayPath)}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br",
              cfg.placeholder
            )}
          >
            <span className="select-none text-6xl opacity-[0.15]">{cfg.symbol}</span>
          </div>
        )}

        {/* Type badge — always visible */}
        <span
          className={cn(
            "absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
            cfg.badge
          )}
        >
          {cfg.label}
        </span>

        {/* Hover overlay */}
        <div className="absolute inset-0 z-20 flex flex-col rounded-2xl bg-black/0 transition-colors duration-200 group-hover:bg-black/75">
          {/* Top row: delete control */}
          <div className="flex items-start justify-end p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {!confirmDelete ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 backdrop-blur-sm transition-colors hover:bg-red-500/70 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl bg-black/50 px-2 py-1 backdrop-blur-sm">
                <span className="text-[11px] text-white/70">Delete?</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className="rounded-md px-1.5 py-0.5 text-[10px] text-white/60 transition-colors hover:bg-white/10"
                >
                  No
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(prompt.id);
                  }}
                  className="rounded-md bg-red-500/70 px-1.5 py-0.5 text-[10px] text-white transition-colors hover:bg-red-500"
                >
                  Yes
                </button>
              </div>
            )}
          </div>

          {/* Bottom: prompt text + actions */}
          <div className="mt-auto space-y-2.5 p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <p className="line-clamp-5 font-mono text-[11px] leading-relaxed text-white/90">
              {prompt.content}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all",
                  copied
                    ? "bg-green-500/30 text-green-300"
                    : "bg-white/15 text-white hover:bg-white/25"
                )}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(prompt);
                }}
                className="flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-medium text-white transition-all hover:bg-white/25"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info strip ── */}
      <div className="flex items-center justify-between px-0.5 pt-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight text-gray-900">
            {prompt.title}
          </p>
          <p className="text-[11px] text-gray-400">{formatRelativeTime(prompt.created_at)}</p>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {prompt.source_url && (
            <a
              href={prompt.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open original source"
              className="rounded p-0.5 text-gray-300 transition-colors hover:text-gray-600"
            >
              <Link2 className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => onFavoriteToggle(prompt.id, !prompt.is_favorite)}
            className="rounded p-0.5 transition-colors"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                prompt.is_favorite
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300 hover:text-amber-300"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prompt modal (new / edit) ─────────────────────────────────────────────────

interface PromptModalProps {
  editing: PromptLibrary | null;
  allImages: Map<string, string>;
  onClose: () => void;
  onSave: (prompt: PromptLibrary) => void;
}

function PromptModal({ editing, allImages, onClose, onSave }: PromptModalProps) {
  const [type, setType] = useState<PromptType>(editing?.type ?? "image_gen");
  const [content, setContent] = useState(editing?.content ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [sourceUrl, setSourceUrl] = useState(editing?.source_url ?? "");
  const [outputImageId, setOutputImageId] = useState<string | null>(
    editing?.output_image_id ?? null
  );
  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(() => {
    if (editing?.output_image_id) {
      const path = allImages.get(editing.output_image_id);
      return path ? getThumbnailUrl(path) : null;
    }
    return null;
  });
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleOutputImageFile(file: File) {
    const localUrl = URL.createObjectURL(file);
    setOutputPreviewUrl(localUrl);
    setIsUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/upload", { method: "POST", body: fd });
      if (resp.ok) {
        const data = await resp.json();
        setOutputImageId(data.asset.id);
      }
    } catch {
      // keep preview, clear id
      setOutputImageId(null);
    } finally {
      setIsUploadingImg(false);
    }
  }

  function clearOutputImage() {
    setOutputPreviewUrl(null);
    setOutputImageId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        content,
        type,
        title: title.trim() || undefined,
        output_image_id: outputImageId,
        source_url: sourceUrl.trim() || null,
      };

      let resp: Response;
      if (editing) {
        resp = await fetch(`/api/prompt-library/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        resp = await fetch("/api/prompt-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, source: "manual", source_image_ids: [] }),
        });
      }

      if (resp.ok) {
        const saved = await resp.json();
        onSave(saved);
      }
    } finally {
      setIsSaving(false);
    }
  }

  const TYPE_BUTTONS: { value: PromptType; label: string; Icon: React.ElementType }[] = [
    { value: "image_gen", label: "Image Gen", Icon: Sparkles },
    { value: "image_edit", label: "Image Edit", Icon: Pencil },
    { value: "video_gen", label: "Video Gen", Icon: Play },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            {editing ? "Edit Prompt" : "New Prompt"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Type selector */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">Type</label>
            <div className="flex gap-1.5">
              {TYPE_BUTTONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    type === value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt text */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">Prompt text</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={9}
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder="Enter your prompt…"
            />
          </div>

          {/* Output image */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">
              Output Image{" "}
              <span className="font-normal text-gray-400">(optional — shows as card visual)</span>
            </label>
            {outputPreviewUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-gray-200">
                <img src={outputPreviewUrl} alt="" className="h-40 w-full object-cover" />
                {isUploadingImg && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                <button
                  onClick={clearOutputImage}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-center transition-colors hover:border-gray-300 hover:bg-gray-50">
                <ImagePlus className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs font-medium text-gray-600">Click to upload</p>
                  <p className="text-[11px] text-gray-400">PNG, JPG, WebP, GIF</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleOutputImageFile(f);
                  }}
                />
              </label>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder={editing ? "" : "Auto-generated on save"}
            />
          </div>

          {/* Source URL */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">
              Source URL{" "}
              <span className="font-normal text-gray-400">(optional — link back to original)</span>
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder="https://…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim() || isUploadingImg}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import-from-URL panel ─────────────────────────────────────────────────────

interface ImportPanelProps {
  onImported: (prompt: PromptLibrary) => void;
}

function ImportPanel({ onImported }: ImportPanelProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [type, setType] = useState<PromptType>("image_gen");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!url.trim()) return;
    setError(null);
    setIsImporting(true);
    try {
      const resp = await fetch("/api/prompt-library/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), type }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Import failed");
      } else {
        onImported(data);
        setUrl("");
        setOpen(false);
      }
    } catch {
      setError("Import failed. Check the URL and try again.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="border-b border-black/[0.06]">
      {/* Toggle row */}
      <button
        onClick={() => !isImporting && setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-6 py-3 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        <Link2 className="h-3.5 w-3.5" />
        Import from URL
        <span className="ml-1 text-[10px] text-gray-400">
          inspova.ai, Twitter/X, and more
        </span>
        <span className="ml-auto text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="relative px-6 pb-4 space-y-3">
          {/* Loading overlay */}
          {isImporting && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-b-xl bg-white/90 backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">Importing…</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fetching page, downloading image, saving prompt
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleImport()}
              placeholder="https://inspova.ai/… or https://x.com/…"
              className="h-8 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none"
              autoFocus
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PromptType)}
              className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none"
            >
              <option value="image_gen">Image Gen</option>
              <option value="image_edit">Image Edit</option>
              <option value="video_gen">Video Gen</option>
            </select>
            <button
              onClick={handleImport}
              disabled={!url.trim() || isImporting}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                !url.trim() || isImporting
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              )}
            >
              Import
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptLibrary[]>([]);
  const [allImages, setAllImages] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | PromptType>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptLibrary | null>(null);

  const loadPrompts = useCallback(async () => {
    try {
      const resp = await fetch("/api/prompt-library");
      if (!resp.ok) throw new Error();
      const data: PromptLibrary[] = await resp.json();
      setPrompts(data);

      // Collect all image IDs across output + source images
      const allIds = new Set<string>();
      for (const p of data) {
        if (p.output_image_id) allIds.add(p.output_image_id);
        p.source_image_ids.forEach((id) => allIds.add(id));
      }

      if (allIds.size > 0) {
        const { data: assets } = await supabase
          .from("image_assets")
          .select("id, storage_path")
          .in("id", [...allIds]);
        if (assets) {
          const map = new Map<string, string>();
          assets.forEach((a) => map.set(a.id, a.storage_path));
          setAllImages(map);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return prompts
      .filter((p) => typeFilter === "all" || p.type === typeFilter)
      .filter((p) => !showFavoritesOnly || p.is_favorite)
      .filter(
        (p) =>
          !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
      );
  }, [prompts, typeFilter, showFavoritesOnly, searchQuery]);

  async function handleFavoriteToggle(id: string, value: boolean) {
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, is_favorite: value } : p)));
    await fetch(`/api/prompt-library/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: value }),
    });
  }

  async function handleDelete(id: string) {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/prompt-library/${id}`, { method: "DELETE" });
  }

  function handleEdit(prompt: PromptLibrary) {
    setEditingPrompt(prompt);
    setModalOpen(true);
  }

  function handleModalSave(saved: PromptLibrary) {
    if (editingPrompt) {
      setPrompts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      // Update allImages map if there's a new output_image_id
      if (saved.output_image_id && !allImages.has(saved.output_image_id)) {
        loadPrompts(); // re-fetch to get the new image path
      }
    } else {
      setPrompts((prev) => [saved, ...prev]);
      if (saved.output_image_id) loadPrompts();
    }
    setModalOpen(false);
    setEditingPrompt(null);
  }

  function handleImported(prompt: PromptLibrary) {
    setPrompts((prev) => [prompt, ...prev]);
    if (prompt.output_image_id) loadPrompts();
  }

  function openNewModal() {
    setEditingPrompt(null);
    setModalOpen(true);
  }

  const totalCount = prompts.length;
  const filteredCount = filtered.length;
  const isFiltered = typeFilter !== "all" || showFavoritesOnly || searchQuery.length > 0;
  const description = isFiltered
    ? `${filteredCount} of ${totalCount} prompt${totalCount !== 1 ? "s" : ""}`
    : `${totalCount} prompt${totalCount !== 1 ? "s" : ""}`;

  const TYPE_FILTERS: { value: "all" | PromptType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "image_gen", label: "Image Gen" },
    { value: "image_edit", label: "Image Edit" },
    { value: "video_gen", label: "Video Gen" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      <main className="flex-1 pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/[0.06] bg-white/80 px-6 backdrop-blur-xl">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight text-gray-900">Prompts</h1>
            {!isLoading && (
              <p className="text-xs leading-tight text-gray-500">{description}</p>
            )}
          </div>

          <div className="ml-4 flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts…"
                className="h-8 w-52 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-[13px] text-gray-800 placeholder-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200"
              />
            </div>

            {/* Favorites toggle */}
            <button
              onClick={() => setShowFavoritesOnly((v) => !v)}
              title={showFavoritesOnly ? "Show all" : "Favorites only"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                showFavoritesOnly
                  ? "border-amber-300 bg-amber-50 text-amber-500"
                  : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
              )}
            >
              <Star className={cn("h-4 w-4", showFavoritesOnly && "fill-amber-400")} />
            </button>

            {/* New prompt */}
            <button
              onClick={openNewModal}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              New Prompt
            </button>
          </div>
        </header>

        {/* Import from URL (collapsible) */}
        <ImportPanel onImported={handleImported} />

        {/* Type filter row */}
        <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-white/60 px-6 py-3">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                typeFilter === value
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-gray-100 bg-gray-100"
                  style={{ aspectRatio: "1" }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No prompts yet"
              description={
                isFiltered
                  ? "No prompts match your filters."
                  : "Save prompts from the playground, import from a URL, or create manually."
              }
              action={isFiltered ? undefined : { label: "New Prompt", onClick: openNewModal }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  allImages={allImages}
                  onFavoriteToggle={handleFavoriteToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <PromptModal
          editing={editingPrompt}
          allImages={allImages}
          onClose={() => {
            setModalOpen(false);
            setEditingPrompt(null);
          }}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
