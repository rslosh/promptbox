"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [galleryDlUrl, setGalleryDlUrl] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

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
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const uploadFile of files) {
      if (uploadFile.status !== "pending") continue;

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "uploading" } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", uploadFile.file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        // Update status to processing
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "processing" } : f
          )
        );

        // Trigger tagging
        const data = await response.json();
        await fetch("/api/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: data.asset.id }),
        });

        // Update status to complete
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "complete" } : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "error", error: String(error) }
              : f
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

      if (!response.ok) {
        throw new Error("Gallery-DL import failed");
      }

      setSingleUrl("");
      // Redirect to jobs page to see progress
      window.location.href = "/jobs";
    } catch (error) {
      console.error("Gallery-DL error:", error);
    }
  };

  const handleCreateCollection = async () => {
    if (!galleryDlUrl.trim()) return;

    setIsCreatingCollection(true);

    try {
      // First, create the collection
      const createResponse = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: galleryDlUrl }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || "Failed to create collection");
      }

      const collection = await createResponse.json();

      // Then, trigger the initial sync
      const syncResponse = await fetch(`/api/collections/${collection.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTag: true }),
      });

      let jobId = "";
      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        jobId = syncData.job?.id || "";
      } else {
        console.error("Sync failed, but collection was created");
      }

      setGalleryDlUrl("");
      // Redirect to the collection page with sync indicator
      window.location.href = `/collections/${collection.slug}?syncing=true&job=${jobId}`;
    } catch (error) {
      console.error("Create collection error:", error);
      alert(error instanceof Error ? error.message : "Failed to create collection");
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

        <div className="p-6 space-y-6 max-w-4xl">
          {/* Drop zone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Images
              </CardTitle>
              <CardDescription>
                Drag and drop images or click to browse. Supports PNG, JPG, GIF, and WebP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer",
                  isDragActive
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-white/20 hover:border-white/40 hover:bg-white/5"
                )}
              >
                <input {...getInputProps()} />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <FolderOpen className="h-6 w-6 text-white/60" />
                </div>
                <p className="mt-4 text-sm text-white/60">
                  {isDragActive
                    ? "Drop the files here..."
                    : "Drag & drop images here, or click to select"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File list */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {completeCount}/{files.length} uploaded
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles([])}
                    >
                      Clear all
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={pendingCount === 0 || isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload {pendingCount} {pendingCount === 1 ? "file" : "files"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5"
                    >
                      <div className="aspect-square relative">
                        <img
                          src={file.preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        
                        {/* Status overlay */}
                        <div
                          className={cn(
                            "absolute inset-0 flex items-center justify-center",
                            file.status === "pending" && "bg-black/0",
                            file.status === "uploading" && "bg-black/60",
                            file.status === "processing" && "bg-black/60",
                            file.status === "complete" && "bg-black/40",
                            file.status === "error" && "bg-red-900/60"
                          )}
                        >
                          {file.status === "uploading" && (
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          )}
                          {file.status === "processing" && (
                            <div className="text-center">
                              <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-400" />
                              <span className="mt-1 text-xs text-white">Tagging...</span>
                            </div>
                          )}
                          {file.status === "complete" && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                              <Check className="h-5 w-5 text-white" />
                            </div>
                          )}
                          {file.status === "error" && (
                            <AlertCircle className="h-8 w-8 text-red-400" />
                          )}
                        </div>

                        {/* Remove button */}
                        {file.status === "pending" && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs text-white/60">
                          {file.file.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Collection (Pinterest, etc.) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Import Collection
              </CardTitle>
              <CardDescription>
                Import a Pinterest board, Are.na channel, or Tumblr blog as a synced collection.
                New images added to the source will appear when you sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="https://pinterest.com/username/board-name"
                  value={galleryDlUrl}
                  onChange={(e) => setGalleryDlUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateCollection}
                  disabled={!galleryDlUrl.trim() || isCreatingCollection}
                >
                  {isCreatingCollection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      Create Collection
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-white/40">Supported:</span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  📌 Pinterest
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  🔲 Are.na
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  📝 Tumblr
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Single URL Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Import Single URL
              </CardTitle>
              <CardDescription>
                Import images from a single URL without creating a collection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleGalleryDl}
                  disabled={!singleUrl.trim()}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
