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

const CLAMP_THRESHOLD = 320; // chars before "show more" appears

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
  const isLong = data.content && data.content.length > CLAMP_THRESHOLD;

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
        {/* Copy button — labelled, in header */}
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all",
            copied
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Instruction */}
      {data.instruction && (
        <p className="truncate px-3 pb-1.5 text-[10px] italic text-gray-400">
          "{data.instruction}"
        </p>
      )}

      {/* Content */}
      <div className="px-3 pb-2">
        <p
          className={cn(
            "text-xs text-gray-800 leading-relaxed",
            !expanded && isLong ? "line-clamp-6" : ""
          )}
        >
          {data.content}
        </p>
      </div>

      {/* Expand / collapse — full-width bar */}
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 border-t py-2 text-[11px] font-medium transition-colors",
            expanded
              ? "border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          )}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show full prompt
            </>
          )}
        </button>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-2 !border-white !bg-gray-400"
        style={{ width: 10, height: 10 }}
      />
    </div>
  );
}
