"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { PlaygroundContent } from "./playground-content";
import { Loader2 } from "lucide-react";

function PlaygroundPageContent() {
  const searchParams = useSearchParams();
  const imageIds = searchParams.get("images");
  const initialImageIds = imageIds ? imageIds.split(",") : undefined;

  return <PlaygroundContent initialImageIds={initialImageIds} />;
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-64">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      </main>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PlaygroundPageContent />
    </Suspense>
  );
}
