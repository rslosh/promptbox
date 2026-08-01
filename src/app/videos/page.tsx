"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { IconWell } from "@/components/ui/icon-well";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  X,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Play,
  RefreshCw,
} from "lucide-react";

interface VideoItem {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "analyzing" | "complete" | "error";
  caption?: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const items = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setVideos((prev) => [...prev, ...items]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"],
    },
  });

  const removeVideo = (id: string) => {
    setVideos((prev) => {
      const item = prev.find((v) => v.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((v) => v.id !== id);
    });
  };

  async function analyzeOne(item: VideoItem) {
    setVideos((prev) =>
      prev.map((v) => (v.id === item.id ? { ...v, status: "analyzing", error: undefined } : v))
    );

    try {
      const stored = localStorage.getItem("promptbox_settings");
      const { geminiApiKey, geminiVideoPrompt, videoModel } = stored ? JSON.parse(stored) : {};

      const formData = new FormData();
      formData.append("file", item.file);
      if (geminiApiKey) formData.append("apiKey", geminiApiKey);
      if (geminiVideoPrompt) formData.append("systemPrompt", geminiVideoPrompt);
      if (videoModel) formData.append("model", videoModel);

      const res = await fetch("/api/analyze-video", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Analysis failed (${res.status})`);

      setVideos((prev) =>
        prev.map((v) => (v.id === item.id ? { ...v, status: "complete", caption: data.caption } : v))
      );
    } catch (error) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === item.id
            ? { ...v, status: "error", error: error instanceof Error ? error.message : String(error) }
            : v
        )
      );
    }
  }

  // Sequential so several large uploads don't run concurrent Gemini calls.
  async function analyzeAll() {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    for (const item of videos) {
      if (item.status === "pending" || item.status === "error") {
        await analyzeOne(item);
      }
    }
    setIsAnalyzing(false);
  }

  function copyCaption(item: VideoItem) {
    if (!item.caption) return;
    navigator.clipboard.writeText(item.caption);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function downloadCaption(item: VideoItem) {
    if (!item.caption) return;
    const base = item.file.name.replace(/\.[^.]+$/, "");
    const blob = new Blob([item.caption], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingCount = videos.filter((v) => v.status === "pending" || v.status === "error").length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header title="Videos" description="Upload clips and generate hyper-granular captions" />

        <div className="p-6 space-y-5 max-w-4xl">
          {/* ── Dropzone ── */}
          <section className="rounded-2xl border border-black/[0.07] bg-white/65 backdrop-blur-sm overflow-hidden">
            <div
              {...getRootProps()}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center gap-4 px-8 py-14 transition-all",
                isDragActive
                  ? "bg-[#f2ff59]/10 border-b border-[#f2ff59]"
                  : "border-b border-black/[0.06] hover:bg-black/[0.02]"
              )}
            >
              <input {...getInputProps()} />

              <IconWell
                size="lg"
                variant={isDragActive ? "accent" : "default"}
                className={cn(
                  "transition-colors",
                  !isDragActive && "group-hover:border-black/[0.14] group-hover:text-gray-600"
                )}
              >
                <Clapperboard className="h-5 w-5" />
              </IconWell>

              <div className="text-center">
                <p className={cn("text-sm font-medium", isDragActive ? "text-gray-800" : "text-gray-700")}>
                  {isDragActive ? "Drop to add" : "Drag videos here"}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  or click to browse — MP4, MOV, WebM, MKV
                </p>
              </div>
            </div>

            {videos.length > 0 && (
              <div className="flex items-center justify-between p-4">
                <p className="text-xs text-gray-600">
                  {videos.length} video{videos.length !== 1 ? "s" : ""} ·{" "}
                  {videos.filter((v) => v.status === "complete").length} captioned
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      videos.forEach((v) => URL.revokeObjectURL(v.preview));
                      setVideos([]);
                    }}
                    className="text-xs text-gray-600 transition-colors hover:text-gray-800"
                  >
                    Clear all
                  </button>
                  <button
                    onClick={analyzeAll}
                    disabled={pendingCount === 0 || isAnalyzing}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                      pendingCount === 0 || isAnalyzing
                        ? "cursor-not-allowed bg-black/[0.05] text-gray-400"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    )}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Analyze {pendingCount > 0 ? pendingCount : ""}{" "}
                        {pendingCount === 1 ? "video" : "videos"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Video cards ── */}
          {videos.map((item) => (
            <section
              key={item.id}
              className="rounded-2xl border border-black/[0.07] bg-white/65 backdrop-blur-sm overflow-hidden"
            >
              <div className="flex items-start gap-4 p-4">
                <div className="relative w-48 shrink-0 overflow-hidden rounded-xl border border-black/[0.08] bg-black">
                  <video src={item.preview} controls muted className="aspect-video w-full object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{item.file.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatBytes(item.file.size)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.status === "pending" && (
                        <button
                          onClick={() => analyzeOne(item)}
                          className="flex h-7 items-center gap-1 rounded-lg border border-black/[0.12] px-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-black/[0.2] hover:text-gray-900"
                        >
                          <Play className="h-3 w-3" />
                          Analyze
                        </button>
                      )}
                      {(item.status === "complete" || item.status === "error") && (
                        <button
                          onClick={() => analyzeOne(item)}
                          title="Re-run analysis"
                          className="flex h-7 items-center gap-1 rounded-lg border border-black/[0.12] px-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-black/[0.2] hover:text-gray-900"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Re-run
                        </button>
                      )}
                      <button
                        onClick={() => removeVideo(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/[0.05] hover:text-gray-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.status === "analyzing" && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing with Gemini — large clips can take a couple of minutes…
                    </div>
                  )}

                  {item.status === "error" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <p className="text-xs text-red-600">{item.error}</p>
                    </div>
                  )}
                </div>
              </div>

              {item.status === "complete" && item.caption && (
                <div className="border-t border-black/[0.06]">
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                      Caption
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyCaption(item)}
                        className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-900"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => downloadCaption(item)}
                        className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-900"
                      >
                        <Download className="h-3 w-3" />
                        .txt
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap border-t border-black/[0.06] bg-black/[0.02] px-4 py-3 font-sans text-xs leading-relaxed text-gray-800">
                    {item.caption}
                  </pre>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
