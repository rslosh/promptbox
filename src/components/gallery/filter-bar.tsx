"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronDown, Check, FolderOpen, ArrowUpDown, Shuffle } from "lucide-react";
import type { Collection } from "@/lib/supabase/types";
import type { SortBy } from "@/lib/gallery-cache";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "random", label: "Random" },
];

interface FilterBarProps {
  tags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  sourceFilter: "all" | "upload" | "gallery_dl";
  onSourceFilterChange: (source: "all" | "upload" | "gallery_dl") => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
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
        <div className="flex items-center rounded-lg border border-black/[0.08] bg-black/[0.03] p-0.5">
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
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-black/[0.08]" />

        {/* Collections dropdown */}
        {collections.length > 0 && onCollectionsChange && (
          <div className="relative" ref={collectionRef}>
            <button
              onClick={() => setShowCollectionDropdown((v) => !v)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                selectedCollections.length > 0
                  ? "border-[#f2ff59] bg-[#f2ff59]/30 text-gray-800"
                  : "border-black/[0.1] bg-black/[0.03] text-gray-700 hover:border-black/[0.18] hover:text-gray-900"
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
              <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[200px] max-h-72 overflow-y-auto rounded-xl border border-black/[0.08] bg-white/95 py-1 shadow-lg backdrop-blur-xl">
                {collections.map((col) => {
                  const active = selectedCollections.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleCollection(col.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-[#f2ff59]/20 text-gray-900"
                          : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          active ? "border-gray-900 bg-gray-900" : "border-black/[0.15]"
                        )}
                      >
                        {active && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="flex-1 truncate">{col.name}</span>
                      <span className="tabular-nums text-xs text-gray-600">{col.image_count}</span>
                    </button>
                  );
                })}

                {selectedCollections.length > 0 && (
                  <>
                    <div className="my-1 mx-2 h-px bg-black/[0.06]" />
                    <button
                      onClick={() => {
                        onCollectionsChange([]);
                        setShowCollectionDropdown(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
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
            className="flex h-7 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-black/[0.03] px-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-black/[0.14] hover:text-gray-900"
          >
            {sortBy === "random" ? (
              <Shuffle className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3" />
            )}
            {sortBy === "newest" ? "Newest" : sortBy === "oldest" ? "Oldest" : "Random"}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", showSortDropdown && "rotate-180")}
            />
          </button>

          {showSortDropdown && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-36 rounded-xl border border-black/[0.08] bg-white/95 py-1 shadow-lg backdrop-blur-xl">
              {SORT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    onSortChange(value);
                    setShowSortDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                    sortBy === value
                      ? "text-gray-900 font-medium"
                      : "text-gray-700 hover:bg-black/[0.04] hover:text-gray-900"
                  )}
                >
                  {sortBy === value ? (
                    <Check className="h-3 w-3 text-gray-700" />
                  ) : (
                    <span className="w-3" />
                  )}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter count + clear */}
        {hasActiveFilters && (
          <>
            <div className="h-4 w-px bg-black/[0.08]" />
            <button
              onClick={clearAllFilters}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-black/[0.1] bg-black/[0.04] px-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
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
                  "flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "border-[#f2ff59] bg-[#f2ff59]/40 text-gray-800"
                    : "border-black/[0.1] bg-black/[0.03] text-gray-700 hover:border-black/[0.18] hover:text-gray-900"
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
              className="flex h-6 items-center rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 text-xs text-gray-600 transition-colors hover:text-gray-800"
            >
              {showAllTags ? "Less" : `+${tags.length - 14}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
