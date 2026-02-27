"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { layoutTree } from "@/lib/playground-layout";
import type { PromptTreeNode, PromptTree } from "@/lib/playground-types";
import type {
  ImageAsset,
  AssetTag,
  Prompt,
  PromptComponent,
  PlaygroundRemix,
} from "@/lib/supabase/types";

interface ImageWithPrompt extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

interface UsePromptTreeOptions {
  initialRemixId?: string;
  initialImageIds?: string[];
}

type FloatingBarMode = "generate" | "edit" | "duplicate";

export function usePromptTree({
  initialRemixId,
  initialImageIds,
}: UsePromptTreeOptions = {}) {
  const router = useRouter();

  // Core state
  const [remixId, setRemixId] = useState<string | null>(initialRemixId || null);
  const [remixName, setRemixName] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<ImageWithPrompt[]>([]);
  const [promptComponents, setPromptComponents] = useState<PromptComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Tree state
  const [promptNodes, setPromptNodes] = useState<PromptTree>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [floatingBarMode, setFloatingBarModeState] = useState<FloatingBarMode>("generate");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadCompleteRef = useRef(false);

  // Derived: selected node object
  const selectedNode = selectedNodeId
    ? promptNodes.find((n) => n.id === selectedNodeId) || null
    : null;

  // Load remix
  const loadRemix = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/remixes/${id}`);
        if (!response.ok) throw new Error("Failed to load remix");

        const remix: PlaygroundRemix = await response.json();

        const { data: images } = await supabase
          .from("image_assets")
          .select(`*, tags:asset_tags(*), prompts:prompts(*)`)
          .in("id", remix.image_ids);

        setRemixName(remix.name);
        setSelectedImages(images || []);
        setPromptComponents(remix.prompt_components as unknown as PromptComponent[]);
        setHasUnsavedChanges(false);

        // Hydrate tree from history
        const history = remix.history;
        if (history && typeof history === "object" && !Array.isArray(history) && "nodes" in history) {
          const rawNodes = (history as unknown as { nodes: unknown[] }).nodes;
          if (Array.isArray(rawNodes)) {
            // Ensure content is always a string (guard against legacy shapes)
            const nodes: PromptTree = rawNodes
              .filter((n) => !!n && typeof n === "object")
              .map((n) => {
                const node = n as Record<string, unknown>;
                const content =
                  typeof node.content === "string"
                    ? node.content
                    : typeof node.prompt === "string"
                    ? node.prompt
                    : "";
                return { ...(node as unknown as PromptTreeNode), content };
              });
            setPromptNodes(layoutTree(nodes));
          }
        } else if (Array.isArray(history) && history.length > 0) {
          // Migrate old format: may be string[] or legacy {id,prompt,...}[] objects
          const migratedNodes: PromptTreeNode[] = (history as unknown[])
            .map((item, i): PromptTreeNode | null => {
              let content: string;
              if (typeof item === "string") {
                content = item;
              } else if (item && typeof item === "object") {
                const obj = item as Record<string, unknown>;
                content =
                  (typeof obj.content === "string" ? obj.content : null) ??
                  (typeof obj.prompt === "string" ? obj.prompt : null) ??
                  "";
              } else {
                content = String(item ?? "");
              }
              if (!content) return null;
              return {
                id: `migrated-${i}`,
                content,
                mode: "generate" as const,
                instruction: "",
                imageIds: remix.image_ids,
                parentId: null,
                position: { x: i * 300, y: 0 },
                createdAt: new Date().toISOString(),
              };
            })
            .filter((n): n is PromptTreeNode => n !== null);
          setPromptNodes(layoutTree(migratedNodes));
        }

        initialLoadCompleteRef.current = true;
      } catch (error) {
        console.error("Error loading remix:", error);
        router.push("/playground");
      }
      setIsLoading(false);
    },
    [router]
  );

  // Load images by IDs
  const loadImagesByIds = useCallback(async (ids: string[]) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("image_assets")
        .select(`*, tags:asset_tags(*), prompts:prompts(*)`)
        .in("id", ids);

      setSelectedImages(data || []);
      initialLoadCompleteRef.current = true;
    } catch (error) {
      console.error("Error loading images:", error);
    }
    setIsLoading(false);
  }, []);

  // Initialize
  useEffect(() => {
    if (initialRemixId) {
      loadRemix(initialRemixId);
    } else if (initialImageIds && initialImageIds.length > 0) {
      loadImagesByIds(initialImageIds);
    } else {
      setIsLoading(false);
      initialLoadCompleteRef.current = true;
    }
  }, [initialRemixId, initialImageIds, loadRemix, loadImagesByIds]);

  // Extract prompt components when images change
  useEffect(() => {
    if (!initialLoadCompleteRef.current) return;

    // Recursively flatten a JSON object into { type (dot-path), value } pairs
    function flattenJson(
      obj: Record<string, unknown>,
      prefix = ""
    ): { type: string; value: string }[] {
      const results: { type: string; value: string }[] = [];
      for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "string" && val.trim()) {
          results.push({ type: path, value: val.trim() });
        } else if (typeof val === "number" && !Number.isNaN(val)) {
          results.push({ type: path, value: String(val) });
        } else if (Array.isArray(val)) {
          val.forEach((item, i) => {
            if (typeof item === "string" && item.trim()) {
              results.push({ type: path, value: item.trim() });
            } else if (item && typeof item === "object" && !Array.isArray(item)) {
              flattenJson(item as Record<string, unknown>, path).forEach((r) =>
                results.push(r)
              );
            }
          });
        } else if (val && typeof val === "object" && !Array.isArray(val)) {
          flattenJson(val as Record<string, unknown>, path).forEach((r) =>
            results.push(r)
          );
        }
      }
      return results;
    }

    const components: PromptComponent[] = [];
    selectedImages.forEach((image, imageIndex) => {
      const prompt = image.prompts?.[0];
      if (!prompt?.json_prompt) return;
      const json = prompt.json_prompt as Record<string, unknown>;
      flattenJson(json).forEach(({ type, value }, idx) => {
        components.push({
          id: `${image.id}-${type}-${idx}`,
          type,
          value,
          imageIndex,
          imageId: image.id,
        });
      });
    });

    setPromptComponents(components);
    if (initialLoadCompleteRef.current && remixId) {
      setHasUnsavedChanges(true);
    }
  }, [selectedImages, remixId]);

  // Add prompt nodes after generation
  const addPromptNodes = useCallback((newNodes: PromptTreeNode[]) => {
    setPromptNodes((prev) => {
      const combined = [...prev, ...newNodes];
      return layoutTree(combined);
    });
    setHasUnsavedChanges(true);
  }, []);

  // Select node
  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id === null) {
      setFloatingBarModeState("generate");
    }
  }, []);

  // Set floating bar mode (only when node selected for non-generate)
  const setFloatingBarMode = useCallback(
    (mode: FloatingBarMode) => {
      if (mode !== "generate" && !selectedNodeId) return;
      setFloatingBarModeState(mode);
    },
    [selectedNodeId]
  );

  // Auto-save
  const autoSave = useCallback(async () => {
    if (!remixId || !hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      await fetch(`/api/remixes/${remixId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: remixName,
          image_ids: selectedImages.map((i) => i.id),
          prompt_components: promptComponents,
          edit_instructions: "",
          generated_prompt: promptNodes[promptNodes.length - 1]?.content || "",
          history: { nodes: promptNodes },
        }),
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Auto-save error:", error);
    }
    setIsSaving(false);
  }, [remixId, hasUnsavedChanges, remixName, selectedImages, promptComponents, promptNodes]);

  // Debounced auto-save
  useEffect(() => {
    if (!remixId || !hasUnsavedChanges) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => autoSave(), 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [remixId, hasUnsavedChanges, autoSave]);

  // Create remix
  const createRemix = useCallback(async () => {
    if (selectedImages.length === 0 && promptNodes.length === 0) return null;
    setIsSaving(true);
    try {
      const response = await fetch("/api/remixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: remixName,
          image_ids: selectedImages.map((i) => i.id),
          prompt_components: promptComponents,
          edit_instructions: "",
          generated_prompt: promptNodes[promptNodes.length - 1]?.content || "",
          history: { nodes: promptNodes },
        }),
      });
      if (!response.ok) throw new Error("Failed to create remix");
      const newRemix = await response.json();
      setRemixId(newRemix.id);
      setHasUnsavedChanges(false);
      router.push(`/playground/${newRemix.id}`, { scroll: false });
      return newRemix.id;
    } catch (error) {
      console.error("Create remix error:", error);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [selectedImages, remixName, promptComponents, promptNodes, router]);

  // Save as new
  const saveAsNew = useCallback(async () => {
    const currentId = remixId;
    setRemixId(null);
    setRemixName(null);
    const newId = await createRemix();
    if (!newId) setRemixId(currentId);
    return newId;
  }, [remixId, createRemix]);

  // Add images
  const addImages = useCallback((images: ImageWithPrompt[]) => {
    setSelectedImages((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const newImages = images.filter((i) => !existingIds.has(i.id));
      return [...prev, ...newImages];
    });
  }, []);

  // Remove image
  const removeImage = useCallback((id: string) => {
    setSelectedImages((prev) => prev.filter((i) => i.id !== id));
    setPromptComponents((prev) => prev.filter((c) => c.imageId !== id));
  }, []);

  // Remove component
  const removeComponent = useCallback(
    (id: string) => {
      setPromptComponents((prev) => prev.filter((c) => c.id !== id));
      if (remixId) setHasUnsavedChanges(true);
    },
    [remixId]
  );

  // Clear all
  const clearAll = useCallback(() => {
    setSelectedImages([]);
    setPromptComponents([]);
    setPromptNodes([]);
    setSelectedNodeId(null);
    setFloatingBarModeState("generate");
    setRemixId(null);
    setRemixName(null);
    setHasUnsavedChanges(false);
    router.push("/playground");
  }, [router]);

  // Handle generation complete — creates remix on first generation
  const handleGenerationComplete = useCallback(
    async (newNodes: PromptTreeNode[]) => {
      // Compute final layout synchronously so we don't depend on stale state
      const combined = layoutTree([...promptNodes, ...newNodes]);
      setPromptNodes(combined);
      setHasUnsavedChanges(true);

      if (!remixId) {
        setIsSaving(true);
        try {
          const response = await fetch("/api/remixes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: remixName,
              image_ids: selectedImages.map((i) => i.id),
              prompt_components: promptComponents,
              edit_instructions: "",
              generated_prompt: combined[combined.length - 1]?.content || "",
              history: { nodes: combined },
            }),
          });
          if (!response.ok) throw new Error("Failed to create remix");
          const created = await response.json();
          setRemixId(created.id);
          setHasUnsavedChanges(false);
          // Update URL without triggering Next.js re-mount (avoids clearing node state)
          window.history.replaceState({}, "", `/playground/${created.id}`);
        } catch (error) {
          console.error("Create remix error:", error);
        } finally {
          setIsSaving(false);
        }
      }
    },
    [remixId, promptNodes, remixName, selectedImages, promptComponents]
  );

  return {
    // Identity
    remixId,
    remixName,
    setRemixName,
    // Images & components
    selectedImages,
    promptComponents,
    addImages,
    removeImage,
    removeComponent,
    // Tree
    promptNodes,
    selectedNodeId,
    selectedNode,
    floatingBarMode,
    selectNode,
    setFloatingBarMode,
    addPromptNodes,
    handleGenerationComplete,
    // Status
    isLoading,
    isSaving,
    hasUnsavedChanges,
    // Actions
    clearAll,
    saveAsNew,
    autoSave,
    createRemix,
  };
}
