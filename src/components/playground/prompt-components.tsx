"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { PromptComponent } from "@/lib/supabase/types";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

interface PromptComponentsProps {
  components: PromptComponent[];
  onRemoveComponent: (id: string) => void;
  onInsertToken?: (text: string) => void;
}

// Strip leading "groupName[N]." or "groupName." prefix for display
function stripPrefix(type: string, prefix: string): string {
  const pattern = new RegExp(`^${escapeRegex(prefix)}(\\[\\d+\\])?\\.?`);
  return type.replace(pattern, "") || type;
}
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Single clickable field row
function FieldRow({
  displayKey,
  value,
  onInsertToken,
}: {
  displayKey: string;
  value: string;
  onInsertToken?: (text: string) => void;
}) {
  return (
    <button
      onClick={() => onInsertToken?.(value)}
      disabled={!onInsertToken}
      title={onInsertToken ? `Insert: ${value}` : undefined}
      className={cn(
        "group flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors",
        onInsertToken ? "cursor-pointer hover:bg-[#f2ff59]/25" : "cursor-default"
      )}
    >
      <span className="mt-0.5 w-28 shrink-0 truncate font-mono text-[9px] text-gray-400">
        {displayKey}
      </span>
      <p className="flex-1 text-[10px] leading-relaxed text-gray-700 line-clamp-3">
        {value}
      </p>
      {onInsertToken && (
        <Plus className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

// An individual array item sub-group: e.g. "Male Subject" (objects[0])
function IndexedItemGroup({
  itemIndex,
  label,
  items,
  groupName,
  onInsertToken,
}: {
  itemIndex: string;
  label: string;
  items: PromptComponent[];
  groupName: string;
  onInsertToken?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const indexedPrefix = `${groupName}[${itemIndex}]`;

  return (
    <div className="overflow-hidden rounded border border-gray-100 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-300" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
        )}
        <span className="flex-1 text-[10px] font-medium text-gray-600 truncate">{label}</span>
        <span className="shrink-0 text-[9px] text-gray-300">{items.length}</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-50 border-t border-gray-100">
          {items.map((c) => (
            <FieldRow
              key={c.id}
              displayKey={stripPrefix(c.type, indexedPrefix)}
              value={c.value}
              onInsertToken={onInsertToken}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Top-level JSON key group (e.g. "meta", "objects", "global_context")
function TopLevelGroup({
  groupName,
  items,
  colorHex,
  onInsertToken,
  defaultOpen,
}: {
  groupName: string;
  items: PromptComponent[];
  colorHex: string;
  onInsertToken?: (text: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  // Detect whether items have indexed paths (e.g. objects[0].label)
  const hasIndexed = items.some((c) => /\[\d+\]/.test(c.type));

  // Group by array index when present
  const indexGroups = new Map<string, PromptComponent[]>();
  if (hasIndexed) {
    for (const c of items) {
      const m = c.type.match(/\[(\d+)\]/);
      const idx = m ? m[1] : "0";
      if (!indexGroups.has(idx)) indexGroups.set(idx, []);
      indexGroups.get(idx)!.push(c);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50/80 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
        )}
        <span className="flex-1 font-mono text-[10px] font-semibold text-gray-600">
          {groupName}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[8px] font-bold text-white"
          style={{ backgroundColor: colorHex }}
        >
          {hasIndexed ? indexGroups.size : items.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {hasIndexed ? (
            // Render one collapsible sub-group per array index, labelled by .label or .id
            <div className="space-y-0.5 p-1.5">
              {[...indexGroups.entries()].map(([idx, subItems]) => {
                const labelField = subItems.find((c) =>
                  c.type.endsWith(`[${idx}].label`)
                );
                const idField = subItems.find((c) =>
                  c.type.endsWith(`[${idx}].id`)
                );
                const displayLabel =
                  labelField?.value || idField?.value || `item ${idx}`;
                return (
                  <IndexedItemGroup
                    key={idx}
                    itemIndex={idx}
                    label={displayLabel}
                    items={subItems}
                    groupName={groupName}
                    onInsertToken={onInsertToken}
                  />
                );
              })}
            </div>
          ) : (
            // Flat list for non-indexed groups
            <div className="divide-y divide-gray-50">
              {items.map((c) => (
                <FieldRow
                  key={c.id}
                  displayKey={stripPrefix(c.type, groupName)}
                  value={c.value}
                  onInsertToken={onInsertToken}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Group flat component list by first dot-path segment (strip [N] indices)
function groupByTopLevel(components: PromptComponent[]): [string, PromptComponent[]][] {
  const map = new Map<string, PromptComponent[]>();
  for (const c of components) {
    const group = c.type.split(".")[0].replace(/\[\d+\]$/, "");
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(c);
  }
  return [...map.entries()];
}

// Per-image collapsible block
function ImageGroup({
  imageIndex,
  components,
  onInsertToken,
}: {
  imageIndex: number;
  components: PromptComponent[];
  onInsertToken?: (text: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const color = getImageColor(imageIndex);
  const label = getImageLabel(imageIndex);
  const groups = groupByTopLevel(components);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
        <div
          className="flex h-5 w-10 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
          style={{ backgroundColor: color.hex }}
        >
          {label}
        </div>
        <span className="text-[10px] font-medium text-gray-500">
          {components.length} fields
        </span>
      </button>

      {open && (
        <div className="space-y-1 border-t border-gray-50 p-2">
          {groups.map(([groupName, groupItems], i) => (
            <TopLevelGroup
              key={groupName}
              groupName={groupName}
              items={groupItems}
              colorHex={color.hex}
              onInsertToken={onInsertToken}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PromptComponents({
  components,
  onRemoveComponent: _onRemoveComponent,
  onInsertToken,
}: PromptComponentsProps) {
  const groupedByImage = components.reduce(
    (acc, c) => {
      if (!acc[c.imageIndex]) acc[c.imageIndex] = [];
      acc[c.imageIndex].push(c);
      return acc;
    },
    {} as Record<number, PromptComponent[]>
  );

  const imageIndices = Object.keys(groupedByImage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Image Fields
        </p>
        {components.length > 0 && (
          <span className="text-[10px] text-gray-400">{components.length} fields</span>
        )}
      </div>

      {components.length > 0 ? (
        <div className="space-y-2">
          {imageIndices.map((imageIndex) => (
            <ImageGroup
              key={imageIndex}
              imageIndex={imageIndex}
              components={groupedByImage[imageIndex]}
              onInsertToken={onInsertToken}
            />
          ))}
          {onInsertToken && (
            <p className="px-1 text-[10px] text-gray-300">
              Click any field to insert it at cursor
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-xs text-gray-400">Select images to see their fields</p>
          <p className="mt-1 text-[10px] text-gray-300">
            Click fields to insert them into your prompt
          </p>
        </div>
      )}
    </div>
  );
}
