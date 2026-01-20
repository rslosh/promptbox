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
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-black/50 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold text-white">Promptbox</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-purple-600/20 text-purple-300"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Collections Section */}
        <div className="mt-6">
          <button
            onClick={() => setCollectionsExpanded(!collectionsExpanded)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white/60"
          >
            <span className="flex items-center gap-2">
              <FolderHeart className="h-4 w-4" />
              Collections
            </span>
            {collectionsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {collectionsExpanded && (
            <div className="mt-1 space-y-1">
              {isLoading ? (
                <div className="px-3 py-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                </div>
              ) : collections.length === 0 ? (
                <p className="px-3 py-2 text-xs text-white/30">
                  No collections yet
                </p>
              ) : (
                collections.map((collection) => {
                  const isActive = pathname === `/collections/${collection.slug}`;
                  return (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.slug}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-purple-600/20 text-purple-300"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="text-base">
                        {platformIcons[collection.platform]}
                      </span>
                      <span className="flex-1 truncate">{collection.name}</span>
                      <span className="text-xs text-white/30">
                        {collection.image_count}
                      </span>
                    </Link>
                  );
                })
              )}

              {/* Add Collection Link */}
              <Link
                href="/upload"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40 hover:bg-white/5 hover:text-white/60"
              >
                <Plus className="h-4 w-4" />
                <span>Add Collection</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-xs text-white/40">
            Organize, tag, and remix your AI prompts
          </p>
        </div>
      </div>
    </aside>
  );
}
