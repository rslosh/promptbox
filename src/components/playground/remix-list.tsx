"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { PlaygroundRemix } from "@/lib/supabase/types";
import {
  Plus,
  FolderOpen,
  Trash2,
  Clock,
  Images,
  Loader2,
  Sparkles,
} from "lucide-react";

interface RemixListProps {
  onCreateNew: () => void;
}

export function RemixList({ onCreateNew }: RemixListProps) {
  const router = useRouter();
  const [remixes, setRemixes] = useState<PlaygroundRemix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRemixes();
  }, []);

  async function fetchRemixes() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/remixes?limit=50");
      if (response.ok) {
        const data = await response.json();
        setRemixes(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch remixes:", error);
    }
    setIsLoading(false);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this remix?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/remixes/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setRemixes((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete remix:", error);
    }
    setDeletingId(null);
  }

  function handleOpen(id: string) {
    router.push(`/playground/${id}`);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Your Remixes</h2>
          <p className="text-sm text-white/60">
            {remixes.length} saved remix{remixes.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Remix
        </Button>
      </div>

      {/* Remix grid */}
      {remixes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {remixes.map((remix) => {
            const imageCount = remix.image_ids?.length || 0;
            const hasPrompt = !!remix.generated_prompt;
            const isDeleting = deletingId === remix.id;

            return (
              <Card
                key={remix.id}
                className={cn(
                  "group cursor-pointer transition-all hover:border-purple-500/50 hover:bg-white/5",
                  isDeleting && "opacity-50 pointer-events-none"
                )}
                onClick={() => handleOpen(remix.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-white">
                        {remix.name || "Untitled remix"}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(remix.updated_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(remix.id, e)}
                      className="shrink-0 rounded p-1.5 opacity-0 transition-all hover:bg-red-500/20 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4 text-white/40 hover:text-red-400" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      <Images className="mr-1 h-3 w-3" />
                      {imageCount} image{imageCount !== 1 ? "s" : ""}
                    </Badge>
                    {hasPrompt && (
                      <Badge
                        variant="outline"
                        className="border-green-500/30 bg-green-500/10 text-green-400 text-xs"
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Generated
                      </Badge>
                    )}
                  </div>

                  {/* Preview of generated prompt */}
                  {remix.generated_prompt && (
                    <p className="mt-3 line-clamp-2 text-xs text-white/50">
                      {remix.generated_prompt}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-purple-500/10 p-4">
              <FolderOpen className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="mt-4 font-medium text-white">No remixes yet</h3>
            <p className="mt-1 text-sm text-white/60">
              Create your first remix by selecting images and generating a prompt
            </p>
            <Button onClick={onCreateNew} className="mt-6">
              <Plus className="mr-2 h-4 w-4" />
              Create New Remix
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
