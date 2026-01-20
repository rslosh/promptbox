"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { PromptComponent } from "@/lib/supabase/types";
import { X } from "lucide-react";

interface PromptComponentsProps {
  components: PromptComponent[];
  onRemoveComponent: (id: string) => void;
}

export function PromptComponents({
  components,
  onRemoveComponent,
}: PromptComponentsProps) {
  // Group components by image
  const groupedComponents = components.reduce((acc, component) => {
    const key = component.imageIndex;
    if (!acc[key]) acc[key] = [];
    acc[key].push(component);
    return acc;
  }, {} as Record<number, PromptComponent[]>);

  const imageIndices = Object.keys(groupedComponents).map(Number).sort((a, b) => a - b);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Prompt Components</CardTitle>
          {components.length > 0 && (
            <span className="text-xs text-white/40">{components.length} fields</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {components.length > 0 ? (
          <div className="max-h-[500px] space-y-4 overflow-y-auto pr-1">
            {imageIndices.map((imageIndex) => {
              const color = getImageColor(imageIndex);
              const label = getImageLabel(imageIndex);
              const imageComponents = groupedComponents[imageIndex];

              return (
                <div key={imageIndex} className="space-y-2">
                  {/* Image header with strong color bar */}
                  <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", color.bg)}>
                    <div
                      className={cn(
                        "flex h-7 w-14 items-center justify-center rounded-md text-xs font-bold",
                        color.dot,
                        "text-white"
                      )}
                    >
                      {label}
                    </div>
                    <span className={cn("text-xs font-medium", color.text)}>
                      {imageComponents.length} component{imageComponents.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Components for this image */}
                  <div className="space-y-1.5 pl-2">
                    {imageComponents.map((component) => (
                      <div
                        key={component.id}
                        className={cn(
                          "group flex items-start gap-2 rounded-lg border-l-4 bg-white/5 py-2 pl-3 pr-2 transition-colors hover:bg-white/10",
                          color.border
                        )}
                      >
                        {/* Component type badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 border-0 text-[10px]",
                            color.bg,
                            color.text
                          )}
                        >
                          {component.type}
                        </Badge>

                        {/* Component value */}
                        <p className="line-clamp-2 flex-1 text-xs text-white/70">
                          {component.value}
                        </p>

                        {/* Remove button */}
                        <button
                          onClick={() => onRemoveComponent(component.id)}
                          className="shrink-0 rounded p-1 opacity-0 transition-all hover:bg-red-500/20 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-white/40 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-white/40">
              Select images to extract prompt components
            </p>
            <p className="mt-1 text-xs text-white/30">
              Each image's JSON fields will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
