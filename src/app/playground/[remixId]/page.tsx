"use client";

import { use } from "react";
import { PlaygroundContent } from "../playground-content";

interface PageProps {
  params: Promise<{ remixId: string }>;
}

export default function RemixPage({ params }: PageProps) {
  const { remixId } = use(params);
  
  return <PlaygroundContent remixId={remixId} />;
}
