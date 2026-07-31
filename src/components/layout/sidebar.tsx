"use client";

import { useState, useEffect, useRef } from "react";
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

// Every page renders its own <Sidebar/>, so navigation remounts it. These
// module-level caches carry the collections list and the user's expand/
// collapse choices across mounts (localStorage adds cross-session persistence).
const UI_STATE_KEY = "promptbox_sidebar_ui";
let cachedCollections: Collection[] | null = null;
let cachedUi: { collapsed: string[]; expanded: boolean } | null = null;

export function Sidebar() {
  const pathname = usePathname();
  const [collections, setCollections] = useState<Collection[]>(cachedCollections ?? []);
  const [collectionsExpanded, setCollectionsExpanded] = useState(cachedUi?.expanded ?? true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(cachedUi?.collapsed ?? [])
  );
  const [isLoading, setIsLoading] = useState(cachedCollections === null);
  const uiInitialized = useRef(cachedUi !== null);

  // First mount of the session: hydrate expand/collapse state from
  // localStorage (deferred to an effect so SSR markup matches).
  useEffect(() => {
    if (uiInitialized.current) return;
    try {
      const stored = localStorage.getItem(UI_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { collapsed: string[]; expanded: boolean };
        setCollapsedGroups(new Set(parsed.collapsed));
        setCollectionsExpanded(parsed.expanded);
        cachedUi = parsed;
      } else {
        cachedUi = { collapsed: [], expanded: true };
      }
    } catch {
      cachedUi = { collapsed: [], expanded: true };
    }
    uiInitialized.current = true;
  }, []);

  // Persist expand/collapse choices (skipped until hydration completes so
  // defaults never clobber the stored state).
  useEffect(() => {
    if (!uiInitialized.current) return;
    const next = { collapsed: [...collapsedGroups], expanded: collectionsExpanded };
    cachedUi = next;
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(next));
    } catch {}
  }, [collapsedGroups, collectionsExpanded]);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    try {
      const response = await fetch("/api/collections");
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
        cachedCollections = data;
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
    <aside className="gos-chrome fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-hairline">
      {/* Logo */}
      <div className="flex h-titlebar items-center gap-2 border-b border-hairline px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent">
          <Sparkles className="h-3 w-3 text-on-accent" />
        </div>
        <span className="text-md font-semibold tracking-[-0.01em] text-primary">Promptbox</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-px">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-instant",
                  isActive
                    ? "bg-active-row text-[var(--active-row-fg)]"
                    : "text-secondary hover:bg-hover-soft hover:text-primary"
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Collections Section */}
        <div className="mt-5">
          <button
            onClick={() => setCollectionsExpanded(!collectionsExpanded)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-tertiary hover:text-secondary transition-colors duration-instant"
          >
            <span className="flex items-center gap-1.5">
              <FolderHeart className="h-3 w-3" />
              Collections
            </span>
            {collectionsExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {collectionsExpanded && (
            <div className="mt-1">
              {isLoading ? (
                <div className="px-2.5 py-1.5">
                  <div className="h-3 w-24 animate-pulse rounded-sm bg-accent-faint" />
                </div>
              ) : collections.length === 0 ? (
                <p className="px-2.5 py-1.5 text-xs text-tertiary">No collections yet</p>
              ) : (
                <div className="space-y-2.5">
                  {grouped.map(({ platform, collections: items }) => {
                    const meta = platformMeta[platform] ?? { label: platform, emoji: "📁" };
                    const isCollapsed = collapsedGroups.has(platform);
                    return (
                      <div key={platform}>
                        {/* Group header */}
                        <button
                          onClick={() => toggleGroup(platform)}
                          className="flex w-full items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-tertiary hover:text-secondary transition-colors duration-instant"
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
                          <div className="space-y-px">
                            {items.map((collection) => {
                              const isActive = pathname === `/collections/${collection.slug}`;
                              return (
                                <Link
                                  key={collection.id}
                                  href={`/collections/${collection.slug}`}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2.5 py-1 text-sm transition-colors duration-instant",
                                    isActive
                                      ? "bg-active-row font-medium text-[var(--active-row-fg)]"
                                      : "text-secondary hover:bg-hover-soft hover:text-primary"
                                  )}
                                >
                                  <span className="flex-1 truncate">{collection.name}</span>
                                  <span className={cn("tabular-nums text-xs shrink-0", isActive ? "text-secondary" : "text-tertiary")}>
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
                className="mt-2 flex items-center gap-2 rounded-md px-2.5 py-1 text-sm text-tertiary transition-colors duration-instant hover:bg-hover-soft hover:text-primary"
              >
                <Plus className="h-3 w-3" />
                <span>Add collection</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-hairline p-3">
        <p className="text-xs leading-relaxed text-tertiary">
          Organize, tag, and remix your AI prompts
        </p>
      </div>
    </aside>
  );
}
