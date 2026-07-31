"use client";

import { use } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ImageInspector } from "@/components/inspector/image-inspector";
import { ArrowLeft } from "lucide-react";

// Full-page fallback for direct loads and "open full page" from the
// lightbox. In-app navigation to /image/[id] is intercepted by the
// @modal route and renders the lightbox instead.
export default function ImageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-60">
        <Header
          title="Image Details"
          actions={
            /* scroll={false}: let the gallery restore its own scroll
               position on return instead of Next jumping to the top. */
            <Link href="/" scroll={false}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
          }
        />

        <div className="p-6">
          <ImageInspector imageId={id} variant="page" />
        </div>
      </main>
    </div>
  );
}
