"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Filter, ChevronDown, FolderOpen, Check } from "lucide-react";
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
  const collectionDropdownRef = useRef<HTMLDivElement>(null);

  const displayedTags = showAllTags ? tags : tags.slice(0, 12);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const toggleCollection = (collectionId: string) => {
    if (!onCollectionsChange) return;
    if (selectedCollections.includes(collectionId)) {
      onCollectionsChange(selectedCollections.filter((c) => c !== collectionId));
    } else {
      onCollectionsChange([...selectedCollections, collectionId]);
    }
  };

  const hasActiveFilters = selectedTags.length > 0 || selectedCollections.length > 0;

  const clearAllFilters = () => {
    onTagsChange([]);
    onCollectionsChange?.([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        collectionDropdownRef.current &&
        !collectionDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCollectionDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      {/* Source, Collection and Sort filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/40" />
          <span className="text-sm text-white/60">Source:</span>
        </div>
        
        <div className="flex gap-1">
          {(["all", "upload", "gallery_dl"] as const).map((source) => (
            <Button
              key={source}
              size="sm"
              variant={sourceFilter === source ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => onSourceFilterChange(source)}
            >
              {source === "all" ? "All" : source === "upload" ? "Uploaded" : "Gallery-DL"}
            </Button>
          ))}
        </div>

        {/* Collection Filter */}
        {collections.length > 0 && onCollectionsChange && (
          <>
            <div className="h-4 w-px bg-white/20" />

            <div className="relative" ref={collectionDropdownRef}>
              <Button
                size="sm"
                variant={selectedCollections.length > 0 ? "default" : "ghost"}
                className={cn(
                  "h-7 text-xs",
                  selectedCollections.length > 0 && "bg-purple-600/30 hover:bg-purple-600/40"
                )}
                onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
              >
                <FolderOpen className="mr-1 h-3 w-3" />
                {selectedCollections.length === 0
                  ? "Collections"
                  : selectedCollections.length === 1
                  ? collections.find((c) => c.id === selectedCollections[0])?.name || "1 selected"
                  : `${selectedCollections.length} collections`}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>

              {showCollectionDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] max-h-[300px] overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl">
                  {collections.map((collection) => {
                    const isSelected = selectedCollections.includes(collection.id);
                    return (
                      <button
                        key={collection.id}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-purple-600/20 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        )}
                        onClick={() => toggleCollection(collection.id)}
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            isSelected
                              ? "border-purple-500 bg-purple-500"
                              : "border-white/30"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="flex-1 truncate">{collection.name}</span>
                        <span className="text-xs text-white/40">{collection.image_count}</span>
                      </button>
                    );
                  })}

                  {selectedCollections.length > 0 && (
                    <>
                      <div className="my-1 h-px bg-white/10" />
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-red-400 hover:bg-white/5"
                        onClick={() => {
                          onCollectionsChange([]);
                          setShowCollectionDropdown(false);
                        }}
                      >
                        <X className="h-3 w-3" />
                        Clear selection
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="h-4 w-px bg-white/20" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">Sort:</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => onSortChange(sortBy === "newest" ? "oldest" : "newest")}
          >
            {sortBy === "newest" ? "Newest first" : "Oldest first"}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </div>

        {hasActiveFilters && (
          <>
            <div className="h-4 w-px bg-white/20" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-400 hover:text-red-300"
              onClick={clearAllFilters}
            >
              Clear filters
              <X className="ml-1 h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayedTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedTags.includes(tag)
                  ? "bg-purple-600/30 hover:bg-purple-600/40"
                  : "hover:bg-white/10"
              )}
              onClick={() => toggleTag(tag)}
            >
              {tag}
              {selectedTags.includes(tag) && (
                <X className="ml-1 h-3 w-3" />
              )}
            </Badge>
          ))}
          
          {tags.length > 12 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setShowAllTags(!showAllTags)}
            >
              {showAllTags ? "Show less" : `+${tags.length - 12} more`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
