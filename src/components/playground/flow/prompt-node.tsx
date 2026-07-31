"use client";

import { useState, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";
import { computeWordDiff } from "@/lib/diff";
import { useHistoryHandler } from "@/contexts/playground-history-context";
import { Copy, Check, ChevronDown, ChevronUp, GitCompare, History, Bookmark } from "lucide-react";

type NodeMode = "generate" | "edit" | "duplicate";

interface PromptNodeData {
  content: string;
  mode: NodeMode;
  instruction: string;
  model?: string;
  parentContent?: string;
  imageIds?: string[];
  onSaveToLibrary?: (content: string, imageIds: string[]) => void;
}

const MODE_STYLES: Record<NodeMode, { badge: string; label: string }> = {
  generate: {
    badge: "bg-accent-faint text-secondary border border-hairline",
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

const CLAMP_THRESHOLD = 320;

// ── Diff renderer ──────────────────────────────────────────────────────────────

function DiffContent({
  oldText,
  newText,
  expanded,
  isLong,
}: {
  oldText: string;
  newText: string;
  expanded: boolean;
  isLong: boolean;
}) {
  const tokens = useMemo(
    () => computeWordDiff(oldText, newText),
    [oldText, newText]
  );

  return (
    <div
      className={cn(
        "text-xs leading-relaxed",
        !expanded && isLong ? "line-clamp-6" : ""
      )}
    >
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token.text)) return <span key={i}>{token.text}</span>;
        if (token.type === "add")
          return (
            <span key={i} className="rounded bg-green-100 text-green-700">
              {token.text}
            </span>
          );
        if (token.type === "remove")
          return (
            <span key={i} className="rounded bg-red-50 text-red-400 line-through">
              {token.text}
            </span>
          );
        return (
          <span key={i} className="text-primary">
            {token.text}
          </span>
        );
      })}
    </div>
  );
}

// ── Main node ──────────────────────────────────────────────────────────────────

export function PromptNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: PromptNodeData;
  selected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const onShowHistory = useHistoryHandler();

  const modeStyle = MODE_STYLES[data.mode] || MODE_STYLES.generate;
  const hasDiff = !!data.parentContent && data.mode !== "generate";
  const hasHistory = data.mode !== "generate";
  const isLong = !!(data.content && data.content.length > CLAMP_THRESHOLD);

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
        className="!border-2 !border-[var(--surface-1)] !bg-tertiary"
        style={{ width: 10, height: 10 }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              modeStyle.badge
            )}
          >
            {modeStyle.label}
          </span>

          {/* Diff toggle — only for edit/duplicate nodes */}
          {hasDiff && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDiff((v) => !v);
              }}
              title={showDiff ? "Show original text" : "Show changes vs parent"}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all",
                showDiff
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-hairline bg-surface text-tertiary hover:border-strong hover:text-secondary"
              )}
            >
              <GitCompare className="h-2.5 w-2.5" />
              Diff
            </button>
          )}

          {/* History button — edit/duplicate nodes */}
          {hasHistory && onShowHistory && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowHistory(id);
              }}
              title="View prompt lineage"
              className="flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10px] font-medium text-tertiary transition-all hover:border-strong hover:text-secondary"
            >
              <History className="h-2.5 w-2.5" />
              Lineage
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Save to library button */}
          {data.onSaveToLibrary && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onSaveToLibrary!(data.content, data.imageIds ?? []);
              }}
              className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium text-tertiary hover:border-strong hover:text-secondary transition-colors"
            >
              <Bookmark className="h-2.5 w-2.5" />
              Save
            </button>
          )}

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all",
              copied
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-hairline bg-surface text-tertiary hover:border-strong hover:bg-hover-soft hover:text-primary"
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
      </div>

      {/* Instruction */}
      {data.instruction && (
        <p className="truncate px-3 pb-1.5 text-[10px] italic text-tertiary">
          "{data.instruction}"
        </p>
      )}

      {/* Content / Diff */}
      <div className="px-3 pb-2">
        {showDiff && hasDiff ? (
          <DiffContent
            oldText={data.parentContent!}
            newText={data.content}
            expanded={expanded}
            isLong={isLong}
          />
        ) : (
          <p
            className={cn(
              "text-xs text-primary leading-relaxed",
              !expanded && isLong ? "line-clamp-6" : ""
            )}
          >
            {data.content}
          </p>
        )}
      </div>

      {/* Model label */}
      {data.model && (
        <div className="px-3 pb-1.5">
          <span className="font-mono text-[9px] text-icon-muted">{data.model}</span>
        </div>
      )}

      {/* Expand / collapse */}
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 border-t py-2 text-[11px] font-medium transition-colors",
            expanded
              ? "border-hairline text-tertiary hover:bg-hover-soft hover:text-secondary"
              : "border-hairline bg-hover-soft text-tertiary hover:bg-accent-faint hover:text-secondary"
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
        className="!border-2 !border-[var(--surface-1)] !bg-tertiary"
        style={{ width: 10, height: 10 }}
      />
    </div>
  );
}
