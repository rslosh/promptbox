"use client";

import { useState, useMemo } from "react";
import { Handle, Position, useNodeId, useNodes, useEdges } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";
import { Copy, Check, Combine } from "lucide-react";

export function MergeNode({ selected }: { selected?: boolean }) {
  const nodeId = useNodeId();
  const nodes = useNodes();
  const edges = useEdges();
  const [copied, setCopied] = useState(false);

  // Derive connected prompt content directly from the RF store
  const connectedPrompts = useMemo(() => {
    const sourceIds = new Set(
      edges.filter((e) => e.target === nodeId).map((e) => e.source)
    );
    return nodes
      .filter((n) => sourceIds.has(n.id) && n.type === "promptNode")
      .map((n) => (n.data as { content: string }).content)
      .filter(Boolean);
  }, [edges, nodes, nodeId]);

  // Output: each prompt on its own line
  const combinedContent = connectedPrompts.join("\n");

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!combinedContent) return;
    const success = await copyToClipboard(combinedContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface shadow-sm transition-shadow",
        selected
          ? "border-accent ring-2 ring-accent shadow-lg"
          : "border-hairline hover:shadow-md"
      )}
      style={{ width: 340 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!border-2 !border-[var(--surface-1)] !bg-orange-400"
        style={{ width: 10, height: 10 }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold text-orange-600">
            <Combine className="h-2.5 w-2.5" />
            Combine
          </span>
          {connectedPrompts.length > 0 && (
            <span className="text-[10px] text-tertiary">
              {connectedPrompts.length} prompt{connectedPrompts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          disabled={!combinedContent}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all",
            copied
              ? "border-green-200 bg-green-50 text-green-700"
              : combinedContent
              ? "border-hairline bg-surface text-tertiary hover:border-strong hover:bg-hover-soft hover:text-primary"
              : "cursor-not-allowed border-hairline bg-hover-soft text-icon-muted"
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
              Copy all
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="px-3 pb-3">
        {connectedPrompts.length === 0 ? (
          <p className="text-xs italic text-tertiary">
            Draw edges from prompt nodes to combine their output
          </p>
        ) : (
          <div className="space-y-0">
            {connectedPrompts.map((content, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="my-2 border-t border-dashed border-hairline" />
                )}
                <p className="line-clamp-3 text-xs leading-relaxed text-secondary">
                  {content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
