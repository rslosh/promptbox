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

// Group a flat component list by the first dot-path segment
function groupByTopLevel(components: PromptComponent[]): [string, PromptComponent[]][] {
  const map = new Map<string, PromptComponent[]>();
  for (const c of components) {
    const group = c.type.split(".")[0];
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(c);
  }
  return [...map.entries()];
}

// Single field row — clickable to insert
function FieldRow({
  component,
  onInsertToken,
}: {
  component: PromptComponent;
  onInsertToken?: (text: string) => void;
}) {
  // Show the sub-path (everything after the first segment) as the key label
  const subKey = component.type.split(".").slice(1).join(".") || component.type;

  return (
    <button
      onClick={() => onInsertToken?.(component.value)}
      disabled={!onInsertToken}
      title={onInsertToken ? `Insert: ${component.value}` : undefined}
      className={cn(
        "group flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors",
        onInsertToken ? "cursor-pointer hover:bg-[#f2ff59]/25" : "cursor-default"
      )}
    >
      <span className="mt-0.5 w-24 shrink-0 truncate font-mono text-[9px] text-gray-400">
        {subKey}
      </span>
      <p className="flex-1 text-[10px] leading-relaxed text-gray-700 line-clamp-2">
        {component.value}
      </p>
      {onInsertToken && (
        <Plus className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

// Collapsible sub-group (one top-level JSON key, e.g. "objects", "meta")
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

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
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
          {items.length}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-gray-50 border-t border-gray-100">
          {items.map((component) => (
            <FieldRow
              key={component.id}
              component={component}
              onInsertToken={onInsertToken}
            />
          ))}
        </div>
      )}
    </div>
  );
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
      {/* Image header */}
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

      {/* Sub-groups */}
      {open && (
        <div className="space-y-1 border-t border-gray-50 p-2">
          {groups.map(([groupName, items], i) => (
            <TopLevelGroup
              key={groupName}
              groupName={groupName}
              items={items}
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
