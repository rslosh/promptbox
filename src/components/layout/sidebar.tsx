"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Collection } from "@/lib/supabase/types";
import {
  Images,
  Upload,
  Sparkles,
  Settings,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FolderHeart,
  Plus,
  BookOpen,
} from "lucide-react";

const navigation = [
  { name: "Gallery", href: "/", icon: Images },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Playground", href: "/playground", icon: Sparkles },
  { name: "Prompts", href: "/prompts", icon: BookOpen },
  { name: "Jobs", href: "/jobs", icon: FolderOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

const platformMeta: Record<string, { label: string; emoji: string }> = {
  pinterest:   { label: "Pinterest",   emoji: "📌" },
  are_na:      { label: "Are.na",      emoji: "🔲" },
  tumblr:      { label: "Tumblr",      emoji: "📝" },
  cosmos:      { label: "Cosmos",      emoji: "✦"  },
  shotdeck:    { label: "Shotdeck",    emoji: "🎬" },
  midjourney:  { label: "Midjourney",  emoji: "🌀" },
  manual:      { label: "Manual",      emoji: "📁" },
};

// Preferred group order
const PLATFORM_ORDER = ["pinterest", "are_na", "tumblr", "cosmos", "shotdeck", "midjourney", "manual"];

export function Sidebar() {
  const pathname = usePathname();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    try {
      const response = await fetch("/api/collections");
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleGroup(platform: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(platform) ? next.delete(platform) : next.add(platform);
      return next;
    });
  }

  // Group collections by platform in preferred order
  const grouped = PLATFORM_ORDER.reduce<{ platform: string; collections: Collection[] }[]>(
    (acc, platform) => {
      const items = collections.filter((c) => c.platform === platform);
      if (items.length > 0) acc.push({ platform, collections: items });
      return acc;
    },
    []
  );
  // Append any unknown platforms at the end
  const knownPlatforms = new Set(PLATFORM_ORDER);
  const unknownItems = collections.filter((c) => !knownPlatforms.has(c.platform ?? ""));
  if (unknownItems.length > 0) grouped.push({ platform: "manual", collections: unknownItems });

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-black/[0.06] bg-white/80 backdrop-blur-2xl">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-black/[0.06] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f2ff59]">
          <Sparkles className="h-3.5 w-3.5 text-gray-900" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-gray-900">Promptbox</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#f2ff59] text-gray-900"
                    : "text-gray-700 hover:bg-black/[0.05] hover:text-gray-900"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Collections Section */}
        <div className="mt-5">
          <button
            onClick={() => setCollectionsExpanded(!collectionsExpanded)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FolderHeart className="h-3.5 w-3.5" />
              Collections
            </span>
            {collectionsExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {collectionsExpanded && (
            <div className="mt-1">
              {isLoading ? (
                <div className="px-3 py-2">
                  <div className="h-3.5 w-24 animate-pulse rounded-md bg-black/[0.07]" />
                </div>
              ) : collections.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-600">No collections yet</p>
              ) : (
                <div className="space-y-3">
                  {grouped.map(({ platform, collections: items }) => {
                    const meta = platformMeta[platform] ?? { label: platform, emoji: "📁" };
                    const isCollapsed = collapsedGroups.has(platform);
                    return (
                      <div key={platform}>
                        {/* Group header */}
                        <button
                          onClick={() => toggleGroup(platform)}
                          className="flex w-full items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <span>{meta.emoji}</span>
                          <span className="flex-1 text-left">{meta.label}</span>
                          {isCollapsed
                            ? <ChevronRight className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                          }
                        </button>

                        {/* Collection items */}
                        {!isCollapsed && (
                          <div className="space-y-0.5">
                            {items.map((collection) => {
                              const isActive = pathname === `/collections/${collection.slug}`;
                              return (
                                <Link
                                  key={collection.id}
                                  href={`/collections/${collection.slug}`}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                                    isActive
                                      ? "bg-[#f2ff59] text-gray-900 font-medium"
                                      : "text-gray-700 hover:bg-black/[0.05] hover:text-gray-900"
                                  )}
                                >
                                  <span className="flex-1 truncate">{collection.name}</span>
                                  <span className={cn("tabular-nums text-xs shrink-0", isActive ? "text-gray-700" : "text-gray-500")}>
                                    {collection.image_count}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Collection Link */}
              <Link
                href="/upload"
                className="mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add collection</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-black/[0.06] p-4">
        <p className="text-[11px] leading-relaxed text-gray-600">
          Organize, tag, and remix your AI prompts
        </p>
      </div>
    </aside>
  );
}
