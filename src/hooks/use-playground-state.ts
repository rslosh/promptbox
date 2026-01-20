"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { ImageAsset, AssetTag, Prompt, PromptComponent, PlaygroundRemix } from "@/lib/supabase/types";

interface ImageWithPrompt extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

interface UsePlaygroundStateOptions {
  initialRemixId?: string;
  initialImageIds?: string[];
}

export function usePlaygroundState({
  initialRemixId,
  initialImageIds,
}: UsePlaygroundStateOptions = {}) {
  const router = useRouter();
  const [remixId, setRemixId] = useState<string | null>(initialRemixId || null);
  const [remixName, setRemixName] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<ImageWithPrompt[]>([]);
  const [promptComponents, setPromptComponents] = useState<PromptComponent[]>([]);
  const [editInstructions, setEditInstructions] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadCompleteRef = useRef(false);

  // Load remix from database
  const loadRemix = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/remixes/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load remix");
      }

      const remix: PlaygroundRemix = await response.json();

      // Fetch images for the remix
      const { data: images } = await supabase
        .from("image_assets")
        .select(`
          *,
          tags:asset_tags(*),
          prompts:prompts(*)
        `)
        .in("id", remix.image_ids);

      setRemixName(remix.name);
      setSelectedImages(images || []);
      setPromptComponents(remix.prompt_components as PromptComponent[]);
      setEditInstructions(remix.edit_instructions);
      setGeneratedPrompt(remix.generated_prompt);
      setHistory(remix.history as string[]);
      setHasUnsavedChanges(false);
      initialLoadCompleteRef.current = true;
    } catch (error) {
      console.error("Error loading remix:", error);
      router.push("/playground");
    }
    setIsLoading(false);
  }, [router]);

  // Load images by IDs (for URL param initialization)
  const loadImagesByIds = useCallback(async (ids: string[]) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("image_assets")
        .select(`
          *,
          tags:asset_tags(*),
          prompts:prompts(*)
        `)
        .in("id", ids);

      setSelectedImages(data || []);
      initialLoadCompleteRef.current = true;
    } catch (error) {
      console.error("Error loading images:", error);
    }
    setIsLoading(false);
  }, []);

  // Initialize based on props
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

    const components: PromptComponent[] = [];

    selectedImages.forEach((image, imageIndex) => {
      const prompt = image.prompts?.[0];
      if (!prompt?.json_prompt) return;

      const json = prompt.json_prompt as Record<string, unknown>;

      Object.entries(json).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim()) {
          components.push({
            id: `${image.id}-${key}`,
            type: key,
            value: value,
            imageIndex,
            imageId: image.id,
          });
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === "string" && item.trim()) {
              components.push({
                id: `${image.id}-${key}-${index}`,
                type: key,
                value: item,
                imageIndex,
                imageId: image.id,
              });
            }
          });
        }
      });
    });

    setPromptComponents(components);
    
    // Only mark as unsaved if we've completed initial load and this is a user action
    if (initialLoadCompleteRef.current && remixId) {
      setHasUnsavedChanges(true);
    }
  }, [selectedImages, remixId]);

  // Mark as unsaved when instructions change
  useEffect(() => {
    if (initialLoadCompleteRef.current && remixId) {
      setHasUnsavedChanges(true);
    }
  }, [editInstructions, remixId]);

  // Auto-save with debounce
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
          edit_instructions: editInstructions,
          generated_prompt: generatedPrompt,
          history,
        }),
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Auto-save error:", error);
    }
    setIsSaving(false);
  }, [
    remixId,
    hasUnsavedChanges,
    remixName,
    selectedImages,
    promptComponents,
    editInstructions,
    generatedPrompt,
    history,
  ]);

  // Debounced auto-save
  useEffect(() => {
    if (!remixId || !hasUnsavedChanges) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [remixId, hasUnsavedChanges, autoSave]);

  // Create new remix
  const createRemix = useCallback(async () => {
    if (selectedImages.length === 0) return null;

    setIsSaving(true);
    try {
      const response = await fetch("/api/remixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: remixName,
          image_ids: selectedImages.map((i) => i.id),
          prompt_components: promptComponents,
          edit_instructions: editInstructions,
          generated_prompt: generatedPrompt,
          history,
        }),
      });

      if (!response.ok) throw new Error("Failed to create remix");

      const newRemix = await response.json();
      setRemixId(newRemix.id);
      setHasUnsavedChanges(false);

      // Update URL without full navigation
      router.push(`/playground/${newRemix.id}`, { scroll: false });

      return newRemix.id;
    } catch (error) {
      console.error("Create remix error:", error);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedImages,
    remixName,
    promptComponents,
    editInstructions,
    generatedPrompt,
    history,
    router,
  ]);

  // Save as new remix
  const saveAsNew = useCallback(async () => {
    const currentRemixId = remixId;
    setRemixId(null);
    setRemixName(null);
    const newId = await createRemix();
    if (!newId) {
      setRemixId(currentRemixId);
    }
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
  const removeComponent = useCallback((id: string) => {
    setPromptComponents((prev) => prev.filter((c) => c.id !== id));
    if (remixId) setHasUnsavedChanges(true);
  }, [remixId]);

  // Clear all
  const clearAll = useCallback(() => {
    setSelectedImages([]);
    setPromptComponents([]);
    setEditInstructions("");
    setGeneratedPrompt("");
    setHistory([]);
    setRemixId(null);
    setRemixName(null);
    setHasUnsavedChanges(false);
    router.push("/playground");
  }, [router]);

  // Handle generation completion
  const handleGenerationComplete = useCallback(
    async (prompt: string) => {
      setGeneratedPrompt(prompt);
      setHistory((prev) => [prompt, ...prev]);
      setHasUnsavedChanges(true);

      // Create remix on first generation if not already saved
      if (!remixId) {
        await createRemix();
      }
    },
    [remixId, createRemix]
  );

  return {
    remixId,
    remixName,
    setRemixName,
    selectedImages,
    promptComponents,
    editInstructions,
    setEditInstructions,
    generatedPrompt,
    setGeneratedPrompt,
    history,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    addImages,
    removeImage,
    removeComponent,
    clearAll,
    createRemix,
    saveAsNew,
    autoSave,
    handleGenerationComplete,
  };
}
