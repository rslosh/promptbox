"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronDown, Check, FolderOpen, ArrowUpDown } from "lucide-react";
import type { Collection } from "@/lib/supabase/types";

interface FilterBarProps {
  tags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  sourceFilter: "all" | "upload" | "gallery_dl";
  onSourceFilterChange: (source: "all" | "upload" | "gallery_dl") => void;
  sortBy: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
  collections?: Collection[];
  selectedCollections?: string[];
  onCollectionsChange?: (collectionIds: string[]) => void;
}

export function FilterBar({
  tags,
  selectedTags,
  onTagsChange,
  sourceFilter,
  onSourceFilterChange,
  sortBy,
  onSortChange,
  collections = [],
  selectedCollections = [],
  onCollectionsChange,
}: FilterBarProps) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const collectionRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const displayedTags = showAllTags ? tags : tags.slice(0, 14);
  const hasActiveFilters = selectedTags.length > 0 || selectedCollections.length > 0;
  const activeFilterCount = selectedTags.length + selectedCollections.length;

  const toggleTag = (tag: string) => {
    onTagsChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
    );
  };

  const toggleCollection = (id: string) => {
    if (!onCollectionsChange) return;
    onCollectionsChange(
      selectedCollections.includes(id)
        ? selectedCollections.filter((c) => c !== id)
        : [...selectedCollections, id]
    );
  };

  const clearAllFilters = () => {
    onTagsChange([]);
    onCollectionsChange?.([]);
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (collectionRef.current && !collectionRef.current.contains(e.target as Node)) {
        setShowCollectionDropdown(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-1.5">

        {/* Source pills */}
        <div className="flex items-center rounded-lg border border-white/8 bg-white/3 p-0.5">
          {(
            [
              { value: "all", label: "All" },
              { value: "upload", label: "Uploads" },
              { value: "gallery_dl", label: "Imported" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onSourceFilterChange(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                sourceFilter === value
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Collections dropdown */}
        {collections.length > 0 && onCollectionsChange && (
          <div className="relative" ref={collectionRef}>
            <button
              onClick={() => setShowCollectionDropdown((v) => !v)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                selectedCollections.length > 0
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                  : "border-white/8 bg-white/3 text-white/50 hover:border-white/15 hover:text-white/80"
              )}
            >
              <FolderOpen className="h-3 w-3" />
              {selectedCollections.length === 0
                ? "Collections"
                : selectedCollections.length === 1
                ? (collections.find((c) => c.id === selectedCollections[0])?.name ?? "1 selected")
                : `${selectedCollections.length} collections`}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  showCollectionDropdown && "rotate-180"
                )}
              />
            </button>

            {showCollectionDropdown && (
              <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[200px] max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#111] py-1 shadow-2xl backdrop-blur-xl">
                {collections.map((col) => {
                  const active = selectedCollections.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleCollection(col.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-purple-500/10 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          active ? "border-purple-500 bg-purple-500" : "border-white/20"
                        )}
                      >
                        {active && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="flex-1 truncate">{col.name}</span>
                      <span className="tabular-nums text-xs text-white/30">{col.image_count}</span>
                    </button>
                  );
                })}

                {selectedCollections.length > 0 && (
                  <>
                    <div className="my-1 mx-2 h-px bg-white/8" />
                    <button
                      onClick={() => {
                        onCollectionsChange([]);
                        setShowCollectionDropdown(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/5"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sort dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSortDropdown((v) => !v)}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-2.5 text-xs text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortBy === "newest" ? "Newest" : "Oldest"}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", showSortDropdown && "rotate-180")}
            />
          </button>

          {showSortDropdown && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-36 rounded-xl border border-white/10 bg-[#111] py-1 shadow-2xl backdrop-blur-xl">
              {(["newest", "oldest"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSortChange(s);
                    setShowSortDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors capitalize",
                    sortBy === s
                      ? "text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {sortBy === s && <Check className="h-3 w-3 text-purple-400" />}
                  {sortBy !== s && <span className="w-3" />}
                  {s} first
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter count + clear */}
        {hasActiveFilters && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={clearAllFilters}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/50 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <X className="h-3 w-3" />
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
            </button>
          </>
        )}
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displayedTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                  active
                    ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                    : "border-white/8 bg-white/3 text-white/40 hover:border-white/15 hover:text-white/70"
                )}
              >
                {tag}
                {active && <X className="h-2.5 w-2.5" />}
              </button>
            );
          })}

          {tags.length > 14 && (
            <button
              onClick={() => setShowAllTags((v) => !v)}
              className="flex h-6 items-center rounded-full border border-white/8 bg-white/3 px-2.5 text-xs text-white/30 transition-colors hover:text-white/60"
            >
              {showAllTags ? "Less" : `+${tags.length - 14}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
