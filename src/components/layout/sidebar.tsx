"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Collection } from "@/lib/supabase/types";
import { PLATFORM_ORDER, platformMeta, COUNTABLE_PLATFORMS, type Platform } from "@/lib/platforms";
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
  FolderInput,
  Clapperboard,
} from "lucide-react";

const navigation = [
  { name: "Gallery", href: "/", icon: Images },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Videos", href: "/videos", icon: Clapperboard },
  { name: "Playground", href: "/playground", icon: Sparkles },
  { name: "Prompts", href: "/prompts", icon: BookOpen },
  { name: "Jobs", href: "/jobs", icon: FolderOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

// Every page renders its own <Sidebar/>, so navigation remounts it. These
// module-level caches carry the collections list and the user's expand/
// collapse choices across mounts (localStorage adds cross-session persistence).
const UI_STATE_KEY = "promptbox_sidebar_ui";
let cachedCollections: Collection[] | null = null;
let cachedRemoteCounts: Record<string, number | null> | null = null;
let cachedUi: { collapsed: string[]; expanded: boolean } | null = null;

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isUnfiledView = pathname === "/" && searchParams.get("filter") === "unfiled";

  const [collections, setCollections] = useState<Collection[]>(cachedCollections ?? []);
  // Live remote totals (refreshed in the background) keyed by collection id.
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number | null>>(
    cachedRemoteCounts ?? {}
  );
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

  // Background refresh of remote totals for countable platforms (cosmos).
  function refreshRemoteCounts() {
    fetch("/api/collections/pending")
      .then((r) => r.json())
      .then((d) => {
        if (d.remoteCounts) {
          setRemoteCounts((prev) => {
            const next = { ...prev, ...d.remoteCounts };
            cachedRemoteCounts = next;
            return next;
          });
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchCollections();
    refreshRemoteCounts();
    // A finished sync changes image_count (and remote_count) — refetch so the
    // "+N pending" badges clear without a hard reload.
    function onCollectionsChanged() {
      fetchCollections();
      refreshRemoteCounts();
    }
    window.addEventListener("promptbox:collections-changed", onCollectionsChanged);
    return () => window.removeEventListener("promptbox:collections-changed", onCollectionsChanged);
  }, []);

  async function fetchCollections() {
    try {
      const response = await fetch("/api/collections");
      if (response.ok) {
        const data = (await response.json()) as Collection[];
        setCollections(data);
        cachedCollections = data;
        // Seed remote counts from stored values so badges show before the
        // background refresh returns.
        const seed: Record<string, number | null> = {};
        for (const c of data) seed[c.id] = c.remote_count;
        setRemoteCounts((prev) => {
          const next = { ...seed, ...prev };
          cachedRemoteCounts = next;
          return next;
        });
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
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
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
  const knownPlatforms = new Set<string>(PLATFORM_ORDER);
  const unknownItems = collections.filter((c) => !knownPlatforms.has(c.platform ?? ""));
  if (unknownItems.length > 0) grouped.push({ platform: "manual", collections: unknownItems });

  function pendingFor(c: Collection): number {
    if (!COUNTABLE_PLATFORMS.has(c.platform as Platform)) return 0;
    const remote = remoteCounts[c.id];
    if (typeof remote !== "number") return 0;
    return Math.max(0, remote - c.image_count);
  }

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
            // Gallery is only "active" on the plain gallery, not the Uploads view.
            const isActive =
              item.href === "/" ? pathname === "/" && !isUnfiledView : pathname === item.href;
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

        {/* Collections — grouped by platform */}
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
                    const meta = platformMeta(platform);
                    const isCollapsed = collapsedGroups.has(platform);
                    const groupPending = items.reduce((sum, c) => sum + pendingFor(c), 0);
                    return (
                      <div key={platform}>
                        {/* Group header */}
                        <button
                          onClick={() => toggleGroup(platform)}
                          className="flex w-full items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-tertiary hover:text-secondary transition-colors duration-instant"
                        >
                          <span>{meta.icon}</span>
                          <span className="flex-1 text-left">{meta.label}</span>
                          {groupPending > 0 && (
                            <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold tabular-nums text-amber-700">
                              +{groupPending}
                            </span>
                          )}
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
                              const pending = pendingFor(collection);
                              const countable = COUNTABLE_PLATFORMS.has(
                                collection.platform as Platform
                              );
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
                                  {pending > 0 ? (
                                    <span
                                      title={`${pending} new image${pending === 1 ? "" : "s"} to sync`}
                                      className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold tabular-nums text-amber-700"
                                    >
                                      +{pending}
                                    </span>
                                  ) : !countable ? (
                                    <span
                                      title={
                                        collection.last_synced_at
                                          ? `Synced ${formatRelativeTime(collection.last_synced_at)}`
                                          : "Never synced"
                                      }
                                      className={cn(
                                        "h-1.5 w-1.5 shrink-0 rounded-full",
                                        collection.last_synced_at ? "bg-hairline" : "bg-sky-400"
                                      )}
                                    />
                                  ) : null}
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

                  {/* Uploads — images not in any collection */}
                  <Link
                    href="/?filter=unfiled"
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1 text-sm transition-colors duration-instant",
                      isUnfiledView
                        ? "bg-active-row font-medium text-[var(--active-row-fg)]"
                        : "text-secondary hover:bg-hover-soft hover:text-primary"
                    )}
                  >
                    <FolderInput className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">Uploads</span>
                    <span className="text-[10px] text-tertiary">unfiled</span>
                  </Link>
                </div>
              )}

              {/* Add Collection */}
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

// Static shell shown during prerender / before the search-params-dependent
// inner sidebar hydrates, so the nav frame doesn't flash on a hard load.
function SidebarFallback() {
  return (
    <aside className="gos-chrome fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-hairline">
      <div className="flex h-titlebar items-center gap-2 border-b border-hairline px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent">
          <Sparkles className="h-3 w-3 text-on-accent" />
        </div>
        <span className="text-md font-semibold tracking-[-0.01em] text-primary">Promptbox</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-px">
          {navigation.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-secondary"
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {item.name}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}

// useSearchParams (used for the Uploads active state) requires a Suspense
// boundary so pages rendering the sidebar don't bail out of prerendering.
export function Sidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarInner />
    </Suspense>
  );
}
