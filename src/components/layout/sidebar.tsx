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
} from "lucide-react";

const navigation = [
  { name: "Gallery", href: "/", icon: Images },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Playground", href: "/playground", icon: Sparkles },
  { name: "Jobs", href: "/jobs", icon: FolderOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

const platformIcons: Record<string, string> = {
  pinterest: "📌",
  are_na: "🔲",
  tumblr: "📝",
  manual: "📁",
};

export function Sidebar() {
  const pathname = usePathname();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
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

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.08] bg-white/[0.07] backdrop-blur-2xl">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.08] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f2ff59]">
          <Sparkles className="h-3.5 w-3.5 text-[#1c1b18]" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white/90">Promptbox</span>
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
                    ? "bg-[#f2ff59] text-[#1c1b18]"
                    : "text-white/55 hover:bg-white/[0.08] hover:text-white/90"
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
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/55 transition-colors"
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
            <div className="mt-1 space-y-0.5">
              {isLoading ? (
                <div className="px-3 py-2">
                  <div className="h-3.5 w-24 animate-pulse rounded-md bg-white/[0.1]" />
                </div>
              ) : collections.length === 0 ? (
                <p className="px-3 py-2 text-xs text-white/30">No collections yet</p>
              ) : (
                collections.map((collection) => {
                  const isActive = pathname === `/collections/${collection.slug}`;
                  return (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.slug}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-[#f2ff59] text-[#1c1b18] font-medium"
                          : "text-white/55 hover:bg-white/[0.08] hover:text-white/90"
                      )}
                    >
                      <span className="text-base leading-none">
                        {platformIcons[collection.platform]}
                      </span>
                      <span className="flex-1 truncate">{collection.name}</span>
                      <span className={cn("tabular-nums text-xs", isActive ? "text-[#1c1b18]/60" : "text-white/30")}>
                        {collection.image_count}
                      </span>
                    </Link>
                  );
                })
              )}

              {/* Add Collection Link */}
              <Link
                href="/upload"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white/55"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add collection</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.08] p-4">
        <p className="text-[11px] leading-relaxed text-white/25">
          Organize, tag, and remix your AI prompts
        </p>
      </div>
    </aside>
  );
}
