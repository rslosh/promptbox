"use client";

import { useState, useEffect, Suspense } from "react";
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

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isUnfiledView = pathname === "/" && searchParams.get("filter") === "unfiled";

  const [collections, setCollections] = useState<Collection[]>([]);
  // Live remote totals (refreshed in the background) keyed by collection id.
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number | null>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
    // Background refresh of remote totals for countable platforms (cosmos/are_na).
    fetch("/api/collections/pending")
      .then((r) => r.json())
      .then((d) => {
        if (d.remoteCounts) setRemoteCounts(d.remoteCounts);
      })
      .catch(() => {});
  }, []);

  async function fetchCollections() {
    try {
      const response = await fetch("/api/collections");
      if (response.ok) {
        const data = (await response.json()) as Collection[];
        setCollections(data);
        // Seed remote counts from stored values so badges show before the
        // background refresh returns.
        const seed: Record<string, number | null> = {};
        for (const c of data) seed[c.id] = c.remote_count;
        setRemoteCounts((prev) => ({ ...seed, ...prev }));
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function togglePlatform(platform: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  // Group collections by platform, preserving the canonical platform order and
  // dropping platforms with no collections.
  const grouped = PLATFORM_ORDER.map((platform) => ({
    platform,
    items: collections.filter((c) => c.platform === platform),
  })).filter((g) => g.items.length > 0);

  function pendingFor(c: Collection): number {
    if (!COUNTABLE_PLATFORMS.has(c.platform as Platform)) return 0;
    const remote = remoteCounts[c.id];
    if (typeof remote !== "number") return 0;
    return Math.max(0, remote - c.image_count);
  }

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
            // Gallery is only "active" on the plain gallery, not the Uploads view.
            const isActive =
              item.href === "/" ? pathname === "/" && !isUnfiledView : pathname === item.href;
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

        {/* Collections — grouped by platform */}
        <div className="mt-5">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Collections
          </div>

          {isLoading ? (
            <div className="px-3 py-2">
              <div className="h-3.5 w-24 animate-pulse rounded-md bg-black/[0.07]" />
            </div>
          ) : (
            <div className="space-y-2">
              {grouped.map(({ platform, items }) => {
                const meta = platformMeta(platform);
                const isCollapsed = collapsed.has(platform);
                const groupPending = items.reduce((sum, c) => sum + pendingFor(c), 0);
                return (
                  <div key={platform}>
                    {/* Platform header */}
                    <button
                      onClick={() => togglePlatform(platform)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.04] hover:text-gray-900"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      )}
                      <span className="text-sm leading-none">{meta.icon}</span>
                      <span className="flex-1 text-left">{meta.label}</span>
                      {groupPending > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold tabular-nums text-amber-700">
                          +{groupPending}
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums text-gray-400">{items.length}</span>
                    </button>

                    {/* Collections in this platform */}
                    {!isCollapsed && (
                      <div className="mt-0.5 space-y-0.5 pl-2">
                        {items.map((collection) => {
                          const isActive = pathname === `/collections/${collection.slug}`;
                          const pending = pendingFor(collection);
                          const countable = COUNTABLE_PLATFORMS.has(collection.platform as Platform);
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
                                    collection.last_synced_at ? "bg-gray-300" : "bg-sky-400"
                                  )}
                                />
                              ) : null}
                              <span
                                className={cn(
                                  "tabular-nums text-xs",
                                  isActive ? "text-gray-700" : "text-gray-500"
                                )}
                              >
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
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  isUnfiledView
                    ? "bg-[#f2ff59] text-gray-900 font-medium"
                    : "text-gray-700 hover:bg-black/[0.05] hover:text-gray-900"
                )}
              >
                <FolderInput className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">Uploads</span>
                <span className="text-[10px] text-gray-400">unfiled</span>
              </Link>

              {/* Add Collection */}
              <Link
                href="/upload"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-800"
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

// Static shell shown during prerender / before the search-params-dependent
// inner sidebar hydrates, so the nav frame doesn't flash on a hard load.
function SidebarFallback() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-black/[0.06] bg-white/80 backdrop-blur-2xl">
      <div className="flex h-14 items-center gap-2.5 border-b border-black/[0.06] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f2ff59]">
          <Sparkles className="h-3.5 w-3.5 text-gray-900" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-gray-900">Promptbox</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {navigation.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700"
            >
              <item.icon className="h-4 w-4 shrink-0" />
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
