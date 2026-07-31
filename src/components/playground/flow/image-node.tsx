"use client";

import Image from "next/image";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/supabase/client";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";

interface ImageNodeData {
  imageId: string;
  storagePath: string;
  sourceRef?: string;
  imageIndex: number;
  hostname?: string;
}

export function ImageNode({ data }: { data: ImageNodeData }) {
  const color = getImageColor(data.imageIndex);
  const label = getImageLabel(data.imageIndex);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border-2 bg-surface px-3 py-2 shadow-sm",
        color.border
      )}
      style={{ width: 160 }}
    >
      {/* Color-coded label */}
      <div
        className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
        style={{ backgroundColor: color.hex }}
      >
        {label}
      </div>

      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <Image
          src={getThumbnailUrl(data.storagePath)}
          alt=""
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[10px] font-medium", color.text)}>
          {data.hostname || data.sourceRef || label}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-2 !border-[var(--surface-1)] !bg-tertiary"
        style={{ width: 10, height: 10 }}
      />
    </div>
  );
}
