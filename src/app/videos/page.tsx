"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { IconWell } from "@/components/ui/icon-well";
import { cn } from "@/lib/utils";
import { VIDEO_CAPTION_STYLES, type VideoCaptionStyleKey } from "@/lib/video-analyzer";
import {
  Clapperboard,
  X,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Download,
  RefreshCw,
} from "lucide-react";

interface StyleResult {
  status: "pending" | "analyzing" | "complete" | "error";
  caption?: string;
  error?: string;
}

interface VideoItem {
  id: string;
  file: File;
  preview: string;
  /** One result per caption style — both styles run for every video. */
  results: Record<VideoCaptionStyleKey, StyleResult>;
}

function freshResults(): Record<VideoCaptionStyleKey, StyleResult> {
  return Object.fromEntries(
    VIDEO_CAPTION_STYLES.map((s) => [s.key, { status: "pending" as const }])
  ) as Record<VideoCaptionStyleKey, StyleResult>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Serializes work: one video at a time (its styles run in parallel), so a
  // big drop doesn't fan out unbounded concurrent Gemini calls.
  const processingRef = useRef(false);
  const [queueTick, setQueueTick] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const items = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      results: freshResults(),
    }));
    // Both caption styles fire automatically — the queue effect picks these up.
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

  function setStyleResult(videoId: string, styleKey: VideoCaptionStyleKey, result: StyleResult) {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, results: { ...v.results, [styleKey]: result } } : v
      )
    );
  }

  async function analyzeStyle(item: VideoItem, styleKey: VideoCaptionStyleKey) {
    const style = VIDEO_CAPTION_STYLES.find((s) => s.key === styleKey)!;
    setStyleResult(item.id, styleKey, { status: "analyzing" });

    try {
      const stored = localStorage.getItem("promptbox_settings");
      const settings = stored ? JSON.parse(stored) : {};
      // User-edited prompt from Settings for this style, else the built-in.
      const systemPrompt =
        (settings as Record<string, string>)[style.settingsKey] || style.defaultPrompt;

      const formData = new FormData();
      formData.append("file", item.file);
      if (settings.geminiApiKey) formData.append("apiKey", settings.geminiApiKey);
      formData.append("systemPrompt", systemPrompt);
      if (settings.videoModel) formData.append("model", settings.videoModel);

      const res = await fetch("/api/analyze-video", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Analysis failed (${res.status})`);

      setStyleResult(item.id, styleKey, { status: "complete", caption: data.caption });
    } catch (error) {
      setStyleResult(item.id, styleKey, {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Queue runner: whenever any video has a pending style and nothing is in
  // flight, analyze the next video's pending styles (both in parallel).
  useEffect(() => {
    if (processingRef.current) return;
    const next = videos.find((v) =>
      VIDEO_CAPTION_STYLES.some((s) => v.results[s.key].status === "pending")
    );
    if (!next) return;

    processingRef.current = true;
    const pendingStyles = VIDEO_CAPTION_STYLES.filter(
      (s) => next.results[s.key].status === "pending"
    );
    Promise.all(pendingStyles.map((s) => analyzeStyle(next, s.key))).finally(() => {
      processingRef.current = false;
      setQueueTick((t) => t + 1); // re-check for more queued work
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, queueTick]);

  function retryStyle(item: VideoItem, styleKey: VideoCaptionStyleKey) {
    // Back to pending — the queue runner picks it up.
    setStyleResult(item.id, styleKey, { status: "pending" });
  }

  function copyCaption(item: VideoItem, styleKey: VideoCaptionStyleKey) {
    const caption = item.results[styleKey].caption;
    if (!caption) return;
    navigator.clipboard.writeText(caption);
    setCopiedId(`${item.id}:${styleKey}`);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function downloadCaption(item: VideoItem, styleKey: VideoCaptionStyleKey) {
    const caption = item.results[styleKey].caption;
    if (!caption) return;
    const base = item.file.name.replace(/\.[^.]+$/, "");
    const blob = new Blob([caption], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${styleKey}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalCaptions = videos.length * VIDEO_CAPTION_STYLES.length;
  const doneCaptions = videos.reduce(
    (sum, v) =>
      sum + VIDEO_CAPTION_STYLES.filter((s) => v.results[s.key].status === "complete").length,
    0
  );
  const isWorking = videos.some((v) =>
    VIDEO_CAPTION_STYLES.some((s) =>
      ["pending", "analyzing"].includes(v.results[s.key].status)
    )
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header
          title="Videos"
          description="Drop clips — every video is captioned in both styles automatically"
        />

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
                  {isDragActive ? "Drop to analyze" : "Drag videos here"}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  or click to browse — MP4, MOV, WebM, MKV · captions start automatically
                </p>
              </div>
            </div>

            {videos.length > 0 && (
              <div className="flex items-center justify-between p-4">
                <p className="flex items-center gap-2 text-xs text-gray-600">
                  {isWorking && <Loader2 className="h-3 w-3 animate-spin" />}
                  {videos.length} video{videos.length !== 1 ? "s" : ""} · {doneCaptions}/
                  {totalCaptions} captions done
                </p>
                <button
                  onClick={() => {
                    videos.forEach((v) => URL.revokeObjectURL(v.preview));
                    setVideos([]);
                  }}
                  className="text-xs text-gray-600 transition-colors hover:text-gray-800"
                >
                  Clear all
                </button>
              </div>
            )}
          </section>

          {/* ── Video cards ── */}
          {videos.map((item) => (
            <section
              key={item.id}
              className="animate-enter rounded-2xl border border-black/[0.07] bg-white/65 backdrop-blur-sm overflow-hidden"
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
                    <button
                      onClick={() => removeVideo(item.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/[0.05] hover:text-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Per-style status chips */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {VIDEO_CAPTION_STYLES.map((s) => {
                      const r = item.results[s.key];
                      return (
                        <span
                          key={s.key}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                            r.status === "complete" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-700",
                            r.status === "error" && "border-red-200 bg-red-50 text-red-600",
                            (r.status === "pending" || r.status === "analyzing") &&
                              "border-black/[0.08] bg-black/[0.03] text-gray-600"
                          )}
                        >
                          {r.status === "analyzing" && (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          )}
                          {r.status === "complete" && <Check className="h-2.5 w-2.5" />}
                          {r.status === "error" && <AlertCircle className="h-2.5 w-2.5" />}
                          {s.label}
                          {r.status === "pending" && " · queued"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* One caption section per style */}
              {VIDEO_CAPTION_STYLES.map((s) => {
                const r = item.results[s.key];
                if (r.status === "pending") return null;
                return (
                  <div key={s.key} className="border-t border-black/[0.06]">
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                        {s.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {r.status === "complete" && (
                          <>
                            <button
                              onClick={() => copyCaption(item, s.key)}
                              className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-900"
                            >
                              {copiedId === `${item.id}:${s.key}` ? (
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
                              onClick={() => downloadCaption(item, s.key)}
                              className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-900"
                            >
                              <Download className="h-3 w-3" />
                              .txt
                            </button>
                          </>
                        )}
                        {(r.status === "complete" || r.status === "error") && (
                          <button
                            onClick={() => retryStyle(item, s.key)}
                            title={`Re-run ${s.label}`}
                            className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.05] hover:text-gray-900"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Re-run
                          </button>
                        )}
                      </div>
                    </div>

                    {r.status === "analyzing" && (
                      <div className="flex items-center gap-2 border-t border-black/[0.06] bg-black/[0.02] px-4 py-3 text-xs text-gray-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing with Gemini — large clips can take a couple of minutes…
                      </div>
                    )}

                    {r.status === "error" && (
                      <div className="flex items-start gap-2 border-t border-black/[0.06] bg-red-50/60 px-4 py-3">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        <p className="text-xs text-red-600">{r.error}</p>
                      </div>
                    )}

                    {r.status === "complete" && r.caption && (
                      <pre className="animate-enter max-h-96 overflow-y-auto whitespace-pre-wrap border-t border-black/[0.06] bg-black/[0.02] px-4 py-3 font-sans text-xs leading-relaxed text-gray-800">
                        {r.caption}
                      </pre>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
