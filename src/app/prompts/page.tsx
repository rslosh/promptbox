"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Type badge ──────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<
  PromptLibrary["type"],
  { label: string; classes: string }
> = {
  image_gen: {
    label: "Image Gen",
    classes: "bg-amber-50 border border-amber-300 text-amber-700",
  },
  image_edit: {
    label: "Image Edit",
    classes: "bg-violet-50 border border-violet-300 text-violet-700",
  },
  video_gen: {
    label: "Video Gen",
    classes: "bg-cyan-50 border border-cyan-300 text-cyan-700",
  },
};

// ── Prompt card ─────────────────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: PromptLibrary;
  sourceImages: Map<string, string>;
  onFavoriteToggle: (id: string, value: boolean) => void;
  onEdit: (prompt: PromptLibrary) => void;
  onDelete: (id: string) => void;
}

function PromptCard({ prompt, sourceImages, onFavoriteToggle, onEdit, onDelete }: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);

  const typeStyle = TYPE_STYLES[prompt.type];

  async function handleCopy() {
    const success = await copyToClipboard(prompt.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const thumbIds = prompt.source_image_ids.slice(0, 3);
  const extraCount = prompt.source_image_ids.length - 3;

  return (
    <div
      className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      onMouseLeave={() => {
        if (!confirmingDelete) setShowDeleteOverlay(false);
      }}
      onMouseEnter={() => setShowDeleteOverlay(true)}
    >
      {/* Delete button (hover) */}
      {showDeleteOverlay && !confirmingDelete && (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Inline delete confirm overlay */}
      {confirmingDelete && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm">
          <p className="mb-3 text-sm font-medium text-gray-800">Delete this prompt?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmingDelete(false);
                setShowDeleteOverlay(false);
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(prompt.id)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <p className="flex-1 truncate text-sm font-semibold text-gray-900">{prompt.title}</p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", typeStyle.classes)}>
          {typeStyle.label}
        </span>
      </div>

      {/* Content preview */}
      <div className="flex-1 px-4 pb-3">
        <p className="line-clamp-4 font-mono text-xs leading-relaxed text-gray-600">
          {prompt.content}
        </p>
      </div>

      {/* Source image thumbnails */}
      {prompt.source_image_ids.length > 0 && (
        <div className="flex items-center gap-1 px-4 pb-3">
          {thumbIds.map((imgId) => {
            const path = sourceImages.get(imgId);
            if (!path) return null;
            return (
              <img
                key={imgId}
                src={getThumbnailUrl(path)}
                alt=""
                className="h-5 w-5 rounded object-cover ring-1 ring-gray-200"
              />
            );
          })}
          {extraCount > 0 && (
            <span className="text-[10px] text-gray-400">+{extraCount}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all",
              copied
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => onEdit(prompt)}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onFavoriteToggle(prompt.id, !prompt.is_favorite)}
            className="transition-colors"
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                prompt.is_favorite
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300 hover:text-amber-300"
              )}
            />
          </button>
          <span className="text-[11px] text-gray-400">{formatRelativeTime(prompt.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Prompt modal ────────────────────────────────────────────────────────────────

type PromptType = "image_gen" | "image_edit" | "video_gen";

interface PromptModalProps {
  editing: PromptLibrary | null;
  onClose: () => void;
  onSave: (prompt: PromptLibrary) => void;
}

function PromptModal({ editing, onClose, onSave }: PromptModalProps) {
  const [type, setType] = useState<PromptType>(editing?.type ?? "image_gen");
  const [content, setContent] = useState(editing?.content ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      if (editing) {
        const resp = await fetch(`/api/prompt-library/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, type, title: title || undefined }),
        });
        if (resp.ok) {
          const updated = await resp.json();
          onSave(updated);
        }
      } else {
        const resp = await fetch("/api/prompt-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            type,
            source: "manual",
            title: title || undefined,
          }),
        });
        if (resp.ok) {
          const created = await resp.json();
          onSave(created);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  const TYPE_BUTTONS: { value: PromptType; label: string }[] = [
    { value: "image_gen", label: "Image Gen" },
    { value: "image_edit", label: "Image Edit" },
    { value: "video_gen", label: "Video Gen" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            {editing ? "Edit Prompt" : "New Prompt"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Type selector */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">Type</label>
            <div className="flex gap-1.5">
              {TYPE_BUTTONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    type === value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
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
              rows={10}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder="Enter your prompt…"
            />
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptLibrary[]>([]);
  const [sourceImages, setSourceImages] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | PromptType>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptLibrary | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      const resp = await fetch("/api/prompt-library");
      if (!resp.ok) throw new Error("Failed to fetch");
      const data: PromptLibrary[] = await resp.json();
      setPrompts(data);

      // Collect unique image IDs
      const allIds = [...new Set(data.flatMap((p) => p.source_image_ids))];
      if (allIds.length > 0) {
        const { data: assets } = await supabase
          .from("image_assets")
          .select("id, storage_path")
          .in("id", allIds);
        if (assets) {
          const map = new Map<string, string>();
          assets.forEach((a) => map.set(a.id, a.storage_path));
          setSourceImages(map);
        }
      }
    } catch (e) {
      console.error("Error loading prompts:", e);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return prompts
      .filter((p) => typeFilter === "all" || p.type === typeFilter)
      .filter((p) => !showFavoritesOnly || p.is_favorite)
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q)
      );
  }, [prompts, typeFilter, showFavoritesOnly, searchQuery]);

  async function handleFavoriteToggle(id: string, value: boolean) {
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_favorite: value } : p))
    );
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
    } else {
      setPrompts((prev) => [saved, ...prev]);
    }
    setModalOpen(false);
    setEditingPrompt(null);
  }

  function openNewModal() {
    setEditingPrompt(null);
    setModalOpen(true);
  }

  const totalCount = prompts.length;
  const filteredCount = filtered.length;
  const isFiltered =
    typeFilter !== "all" || showFavoritesOnly || searchQuery.length > 0;
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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/[0.06] bg-white/80 px-6 backdrop-blur-xl">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">Prompts</h1>
            {!isLoading && (
              <p className="text-xs text-gray-600 leading-tight">{description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
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
              title={showFavoritesOnly ? "Show all" : "Show favorites only"}
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

        {/* Type filter row */}
        <div className="flex items-center gap-1.5 px-6 pt-4">
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-2xl border border-gray-100 bg-gray-50"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No prompts yet"
              description={
                isFiltered
                  ? "No prompts match your current filters."
                  : "Save prompts from the playground or create them manually."
              }
              action={
                isFiltered
                  ? undefined
                  : { label: "New Prompt", onClick: openNewModal }
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  sourceImages={sourceImages}
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
