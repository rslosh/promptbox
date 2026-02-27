"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

type NodeMode = "generate" | "edit" | "duplicate";

interface PromptNodeData {
  content: string;
  mode: NodeMode;
  instruction: string;
  selected?: boolean;
}

const MODE_STYLES: Record<NodeMode, { badge: string; label: string }> = {
  generate: {
    badge: "bg-gray-100 text-gray-600 border border-gray-200",
    label: "Generate",
  },
  edit: {
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    label: "Edit",
  },
  duplicate: {
    badge: "bg-violet-50 text-violet-700 border border-violet-200",
    label: "Variation",
  },
};

export function PromptNode({
  data,
  selected,
}: {
  data: PromptNodeData;
  selected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const modeStyle = MODE_STYLES[data.mode] || MODE_STYLES.generate;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const success = await copyToClipboard(data.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white shadow-sm transition-shadow",
        selected
          ? "border-gray-900 ring-2 ring-gray-900 shadow-lg"
          : "border-gray-200 hover:shadow-md"
      )}
      style={{ width: 340 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!border-2 !border-white !bg-gray-400"
        style={{ width: 10, height: 10 }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            modeStyle.badge
          )}
        >
          {modeStyle.label}
        </span>
        <button
          onClick={handleCopy}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Instruction */}
      {data.instruction && (
        <p className="truncate px-3 pb-1 text-[10px] italic text-gray-400">
          {data.instruction}
        </p>
      )}

      {/* Content */}
      <div className="px-3 pb-1">
        <p
          className={cn(
            "text-xs text-gray-800 leading-relaxed",
            expanded ? "" : "line-clamp-6"
          )}
        >
          {data.content}
        </p>
      </div>

      {/* Show more / less */}
      <div className="px-3 pb-3">
        {data.content && data.content.length > 300 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex items-center gap-1 text-[10px] text-gray-400 transition-colors hover:text-gray-600"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show more
              </>
            )}
          </button>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-2 !border-white !bg-gray-400"
        style={{ width: 10, height: 10 }}
      />
    </div>
  );
}
