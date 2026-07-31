"use client";

import { use } from "react";
import { ImageLightbox } from "@/components/inspector/image-lightbox";

// Intercepts client-side navigation to /image/[id] and renders the
// lightbox over the current page. Direct loads still get the full page.
export default function InterceptedImagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ImageLightbox imageId={id} />;
}
