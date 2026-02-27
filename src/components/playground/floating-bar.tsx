"use client";

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { Zap, Loader2, X, Eye } from "lucide-react";

type FloatingBarMode = "generate" | "edit" | "duplicate";

interface SelectedNode {
  id: string;
  content: string;
}

export interface MentionImage {
  label: string;
  hex: string;
  index: number;
}

export interface FloatingBarHandle {
  insertAtCursor: (text: string) => void;
}

interface InternalMentionState {
  query: string;
  textNode: Text;
  nodeAtIndex: number;
}

interface FloatingBarProps {
  mode: FloatingBarMode;
  onModeChange: (mode: FloatingBarMode) => void;
  selectedNode: SelectedNode | null;
  onDeselectNode: () => void;
  instruction: string;
  onInstructionChange: (value: string) => void;
  duplicateCount: number;
  onDuplicateCountChange: (count: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  panelOpen: boolean;
  error: string | null;
  onClearError: () => void;
  mentionImages: MentionImage[];
  onShowPreview?: () => void;
}

// Extract plain text from contenteditable (mention spans count as @label)
function extractText(el: HTMLElement): string {
  let text = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    } else if (node instanceof HTMLElement && node.dataset.mention) {
      text += `@${node.dataset.mention}`;
    }
  });
  return text;
}

// Detect an active @ query at the current cursor position
function getMentionAtCursor(): InternalMentionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const textBefore = (node.textContent ?? "").slice(0, range.startOffset);
  const atIndex = textBefore.lastIndexOf("@");
  if (atIndex === -1) return null;
  const query = textBefore.slice(atIndex + 1);
  if (query.includes(" ") || query.includes("\n")) return null;
  return { query, textNode: node as Text, nodeAtIndex: atIndex };
}

export const FloatingBar = forwardRef<FloatingBarHandle, FloatingBarProps>(
  function FloatingBar(
    {
      mode,
      onModeChange,
      selectedNode,
      onDeselectNode,
      instruction,
      onInstructionChange,
      duplicateCount,
      onDuplicateCountChange,
      isGenerating,
      onGenerate,
      panelOpen,
      error,
      onClearError,
      mentionImages,
      onShowPreview,
    },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [mentionState, setMentionState] = useState<InternalMentionState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const lastSyncedRef = useRef(instruction);

    // Expose insertAtCursor to parent via ref
    useImperativeHandle(ref, () => ({
      insertAtCursor(text: string) {
        const el = editorRef.current;
        if (!el) return;

        el.focus();
        const sel = window.getSelection();

        // Restore saved cursor position, or fall back to end
        if (savedRangeRef.current) {
          try {
            sel?.removeAllRanges();
            sel?.addRange(savedRangeRef.current);
          } catch {
            // Range may be stale if DOM changed; fall through to end
            savedRangeRef.current = null;
          }
        }

        if (!sel || sel.rangeCount === 0) {
          const endRange = document.createRange();
          endRange.selectNodeContents(el);
          endRange.collapse(false);
          sel?.addRange(endRange);
        }

        const range = sel!.getRangeAt(0);
        range.deleteContents();

        // Add a space before the inserted text if cursor isn't at start or after whitespace
        const textBefore =
          range.startContainer.nodeType === Node.TEXT_NODE
            ? (range.startContainer.textContent ?? "").slice(0, range.startOffset)
            : "";
        const prefix = textBefore.length > 0 && !/\s$/.test(textBefore) ? " " : "";

        const insertNode = document.createTextNode(prefix + text);
        range.insertNode(insertNode);

        // Move cursor to end of inserted text
        range.setStartAfter(insertNode);
        range.collapse(true);
        sel!.removeAllRanges();
        sel!.addRange(range);

        // Save the new position
        savedRangeRef.current = range.cloneRange();

        const newText = extractText(el);
        lastSyncedRef.current = newText;
        onInstructionChange(newText);
      },
    }));

    // Sync external instruction clears (e.g. after generation) into the editor
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (instruction === lastSyncedRef.current) return;
      lastSyncedRef.current = instruction;
      if (instruction === "") {
        el.innerHTML = "";
        savedRangeRef.current = null;
      }
    }, [instruction]);

    // Focus when mode changes
    useEffect(() => {
      editorRef.current?.focus();
    }, [mode]);

    const leftOffset = 256 + (panelOpen ? 280 : 0);
    const hasNode = selectedNode !== null;

    const placeholder =
      mode === "edit"
        ? "Describe what to change…"
        : mode === "duplicate"
        ? "Describe the variation direction…"
        : "Describe how to remix these images…";

    const filteredMentions = mentionState
      ? mentionImages.filter((img) =>
          img.label.toLowerCase().startsWith(mentionState.query.toLowerCase())
        )
      : [];

    const selectMention = useCallback(
      (img: MentionImage, state: InternalMentionState) => {
        const { textNode, nodeAtIndex, query } = state;
        const parent = textNode.parentNode;
        if (!parent || !editorRef.current) return;

        const before = (textNode.textContent ?? "").slice(0, nodeAtIndex);
        const after = (textNode.textContent ?? "").slice(nodeAtIndex + 1 + query.length);

        const mentionSpan = document.createElement("span");
        mentionSpan.textContent = `@${img.label}`;
        mentionSpan.dataset.mention = img.label;
        mentionSpan.contentEditable = "false";
        Object.assign(mentionSpan.style, {
          backgroundColor: img.hex,
          color: "white",
          borderRadius: "4px",
          padding: "1px 6px",
          fontSize: "12px",
          fontWeight: "600",
          display: "inline",
          userSelect: "none",
        });

        const beforeNode = document.createTextNode(before);
        const afterNode = document.createTextNode("\u00A0" + after);

        parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(mentionSpan, textNode);
        parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        const range = document.createRange();
        range.setStart(afterNode, 1);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRangeRef.current = range.cloneRange();

        const text = extractText(editorRef.current);
        lastSyncedRef.current = text;
        onInstructionChange(text);
        setMentionState(null);
        setActiveIndex(0);
      },
      [onInstructionChange]
    );

    function handleBlur() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        try {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        } catch {}
      }
    }

    function handleInput() {
      const el = editorRef.current;
      if (!el) return;
      const text = extractText(el);
      lastSyncedRef.current = text;
      onInstructionChange(text);
      const state = getMentionAtCursor();
      setMentionState(state);
      setActiveIndex(0);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (mentionState && filteredMentions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filteredMentions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(filteredMentions[activeIndex], mentionState);
          return;
        }
        if (e.key === "Escape") {
          setMentionState(null);
          return;
        }
      }

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!isGenerating) onGenerate();
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
      }
    }

    const canGenerate =
      !isGenerating &&
      (mode === "generate"
        ? instruction.trim().length > 0
        : hasNode && instruction.trim().length > 0);

    const showDropdown = mentionState !== null && filteredMentions.length > 0;

    return (
      <div
        className="fixed bottom-0 z-40 transition-all duration-300"
        style={{ left: leftOffset, right: 0, padding: "0 24px 24px" }}
      >
        <div className="mx-auto w-full max-w-2xl">
          {/* Error toast */}
          {error && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={onClearError} className="ml-3 shrink-0 text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* @ mention dropdown */}
          {showDropdown && (
            <div className="mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Reference image
              </div>
              {filteredMentions.map((img, i) => (
                <button
                  key={img.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (mentionState) selectMention(img, mentionState);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    i === activeIndex ? "bg-gray-50" : "hover:bg-gray-50"
                  )}
                >
                  <span
                    className="flex h-6 w-12 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: img.hex }}
                  >
                    {img.label}
                  </span>
                  <span className="text-sm text-gray-700">Image {img.index + 1}</span>
                  {i === activeIndex && (
                    <span className="ml-auto text-[10px] text-gray-300">↵</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white shadow-xl">
            {/* Mode tabs */}
            {hasNode && (
              <div className="flex items-center gap-1 border-b border-gray-100 px-4 pt-3 pb-2">
                {(["generate", "edit", "duplicate"] as FloatingBarMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => onModeChange(m)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      mode === m
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    )}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                    <span className="max-w-[160px] truncate text-xs text-gray-600">
                      {selectedNode?.content.slice(0, 40)}
                      {(selectedNode?.content.length ?? 0) > 40 ? "…" : ""}
                    </span>
                    <button onClick={onDeselectNode} className="text-gray-400 hover:text-gray-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {!hasNode && (
                <div className="shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
                    <div className="h-2 w-2 rounded-full bg-gray-400" />
                  </div>
                </div>
              )}

              {/* Contenteditable rich input */}
              <div className="relative flex-1">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="min-h-[36px] w-full text-sm text-gray-800 focus:outline-none leading-relaxed"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                />
                {/* Placeholder */}
                {!instruction && (
                  <span
                    className="pointer-events-none absolute left-0 top-0 text-sm text-gray-400 select-none"
                    aria-hidden
                  >
                    {placeholder}
                  </span>
                )}
              </div>

              {/* Duplicate count */}
              {mode === "duplicate" && hasNode && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-xs text-gray-500">×</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={duplicateCount}
                    onChange={(e) =>
                      onDuplicateCountChange(
                        Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
                      )
                    }
                    className="w-12 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-center text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={onGenerate}
                disabled={!canGenerate}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  canGenerate
                    ? "bg-[#f2ff59] text-gray-900 hover:bg-[#eeff3a] active:scale-95"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Generating…</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {mode === "generate" ? "Generate" : "Go"}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Hint */}
            <div className="flex items-center justify-between border-t border-gray-50 px-4 py-1.5">
              <p className="text-[10px] text-gray-300">
                ⌘ + Enter to generate · @ to reference an image · click fields to insert
              </p>
              {onShowPreview && mode === "generate" && (
                <button
                  onClick={onShowPreview}
                  className="flex items-center gap-1 text-[10px] text-gray-300 transition-colors hover:text-gray-500"
                >
                  <Eye className="h-3 w-3" />
                  View request
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
