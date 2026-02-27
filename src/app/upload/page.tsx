"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import {
  Upload,
  FolderOpen,
  Link2,
  X,
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  FolderPlus,
  ArrowRight,
} from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
}

const platformMeta = [
  { emoji: "📌", label: "Pinterest" },
  { emoji: "🔲", label: "Are.na" },
  { emoji: "📝", label: "Tumblr" },
];

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [galleryDlUrl, setGalleryDlUrl] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
  });

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    for (const uploadFile of files) {
      if (uploadFile.status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading" } : f))
      );

      try {
        const formData = new FormData();
        formData.append("file", uploadFile.file);

        const response = await fetch("/api/upload", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Upload failed");

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "processing" } : f))
        );

        const data = await response.json();
        await fetch("/api/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: data.asset.id }),
        });

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "complete" } : f))
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "error", error: String(error) } : f
          )
        );
      }
    }

    setIsUploading(false);
  };

  const handleGalleryDl = async () => {
    if (!singleUrl.trim()) return;

    try {
      const response = await fetch("/api/gallery-dl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: singleUrl }),
      });

      if (!response.ok) throw new Error("Gallery-DL import failed");

      setSingleUrl("");
      window.location.href = "/jobs";
    } catch (error) {
      console.error("Gallery-DL error:", error);
    }
  };

  const handleCreateCollection = async () => {
    if (!galleryDlUrl.trim()) return;
    setCollectionError(null);
    setIsCreatingCollection(true);

    try {
      const createResponse = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: galleryDlUrl }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.json();
        throw new Error(err.error || "Failed to create collection");
      }

      const collection = await createResponse.json();

      const syncResponse = await fetch(`/api/collections/${collection.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTag: true }),
      });

      let jobId = "";
      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        jobId = syncData.job?.id || "";
      }

      setGalleryDlUrl("");
      window.location.href = `/collections/${collection.slug}?syncing=true&job=${jobId}`;
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : "Failed to create collection");
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const completeCount = files.filter((f) => f.status === "complete").length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header title="Upload" description="Add images to your library" />

        <div className="p-6 space-y-5 max-w-3xl">

          {/* ── Upload section ── */}
          <section className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center gap-4 px-8 py-14 transition-all",
                isDragActive
                  ? "bg-purple-500/8 border-b border-purple-500/30"
                  : "border-b border-white/6 hover:bg-white/[0.02]"
              )}
            >
              <input {...getInputProps()} />

              {/* Icon */}
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors",
                  isDragActive
                    ? "border-purple-500/40 bg-purple-500/15 text-purple-400"
                    : "border-white/10 bg-white/5 text-white/30 group-hover:border-white/20 group-hover:text-white/50"
                )}
              >
                <FolderOpen className="h-5 w-5" />
              </div>

              <div className="text-center">
                <p className={cn("text-sm font-medium", isDragActive ? "text-purple-300" : "text-white/60")}>
                  {isDragActive ? "Drop to add" : "Drag images here"}
                </p>
                <p className="mt-0.5 text-xs text-white/25">
                  or click to browse — PNG, JPG, GIF, WebP
                </p>
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                  {files.map((file) => (
                    <div key={file.id} className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/5 aspect-square">
                      <img src={file.preview} alt="" className="h-full w-full object-cover" />

                      {/* Status overlay */}
                      <div
                        className={cn(
                          "absolute inset-0 flex flex-col items-center justify-center transition-colors",
                          file.status === "uploading" && "bg-black/60",
                          file.status === "processing" && "bg-black/60",
                          file.status === "complete" && "bg-black/50",
                          file.status === "error" && "bg-red-950/70"
                        )}
                      >
                        {file.status === "uploading" && (
                          <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                        )}
                        {file.status === "processing" && (
                          <div className="flex flex-col items-center gap-1">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                            <span className="text-[10px] text-white/60">Tagging</span>
                          </div>
                        )}
                        {file.status === "complete" && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/80 backdrop-blur-sm">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        {file.status === "error" && (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>

                      {/* Remove button (pending only) */}
                      {file.status === "pending" && (
                        <button
                          onClick={() => removeFile(file.id)}
                          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upload controls */}
                <div className="flex items-center justify-between border-t border-white/6 pt-4">
                  <p className="text-xs text-white/30">
                    {completeCount > 0
                      ? `${completeCount} of ${files.length} uploaded`
                      : `${files.length} file${files.length !== 1 ? "s" : ""} queued`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFiles([])}
                      className="text-xs text-white/30 transition-colors hover:text-white/60"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={pendingCount === 0 || isUploading}
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                        pendingCount === 0 || isUploading
                          ? "cursor-not-allowed bg-white/5 text-white/20"
                          : "bg-purple-600 text-white hover:bg-purple-500"
                      )}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          Upload {pendingCount > 0 ? pendingCount : ""}{" "}
                          {pendingCount === 1 ? "file" : "files"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Import Collection ── */}
          <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40">
                <Link2 className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Import Collection</p>
                <p className="text-xs text-white/35 mt-0.5">
                  Paste a board or channel URL to create a synced collection.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://pinterest.com/username/board-name"
                value={galleryDlUrl}
                onChange={(e) => {
                  setGalleryDlUrl(e.target.value);
                  if (collectionError) setCollectionError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                className="flex h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-colors"
              />
              <button
                onClick={handleCreateCollection}
                disabled={!galleryDlUrl.trim() || isCreatingCollection}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors",
                  !galleryDlUrl.trim() || isCreatingCollection
                    ? "cursor-not-allowed bg-white/5 text-white/20"
                    : "bg-purple-600 text-white hover:bg-purple-500"
                )}
              >
                {isCreatingCollection ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-3.5 w-3.5" />
                    Import
                  </>
                )}
              </button>
            </div>

            {/* Inline error */}
            {collectionError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{collectionError}</p>
              </div>
            )}

            {/* Platform badges */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/20">Supported</span>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex gap-1.5">
                {platformMeta.map(({ emoji, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-xs text-white/40"
                  >
                    <span className="text-[11px]">{emoji}</span>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── Single URL Import ── */}
          <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40">
                <ImageIcon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Import from URL</p>
                <p className="text-xs text-white/35 mt-0.5">
                  Import images from a single URL without creating a collection.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGalleryDl()}
                className="flex h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-colors"
              />
              <button
                onClick={handleGalleryDl}
                disabled={!singleUrl.trim()}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors",
                  !singleUrl.trim()
                    ? "cursor-not-allowed border-white/8 text-white/20"
                    : "border-white/15 text-white/60 hover:border-white/25 hover:text-white"
                )}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Import
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
