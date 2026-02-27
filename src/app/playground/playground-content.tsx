"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Sidebar } from "@/components/layout/sidebar";
import { ImageSelectionModal } from "@/components/playground/image-selection-modal";
import { RemixList } from "@/components/playground/remix-list";
import { RemixControls } from "@/components/playground/remix-controls";
import { LeftPanel } from "@/components/playground/left-panel";
import { FloatingBar, type MentionImage } from "@/components/playground/floating-bar";
import { nodeTypes } from "@/components/playground/flow";
import { usePromptTree } from "@/hooks/use-prompt-tree";
import { getImageNodePositions } from "@/lib/playground-layout";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { PromptTreeNode } from "@/lib/playground-types";
import { Loader2, ChevronDown } from "lucide-react";

interface Settings {
  geminiApiKey: string;
  secondaryLlmApiKey: string;
  remixSystemPrompt: string;
}

interface PlaygroundContentProps {
  remixId?: string;
  initialImageIds?: string[];
}

function PlaygroundCanvas({
  remixId,
  initialImageIds,
}: PlaygroundContentProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [duplicateCount, setDuplicateCount] = useState(3);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showRemixList, setShowRemixList] = useState(!remixId && !initialImageIds?.length);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const reactFlowRef = useRef<HTMLDivElement>(null);

  const {
    remixId: currentRemixId,
    remixName,
    setRemixName,
    selectedImages,
    promptComponents,
    addImages,
    removeImage,
    removeComponent,
    promptNodes,
    selectedNodeId,
    selectedNode,
    floatingBarMode,
    selectNode,
    setFloatingBarMode,
    handleGenerationComplete,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    clearAll,
    saveAsNew,
    autoSave,
  } = usePromptTree({ initialRemixId: remixId, initialImageIds });

  // Load settings
  useEffect(() => {
    const stored = localStorage.getItem("promptbox_settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
  }, []);

  // Sync image nodes into React Flow when selectedImages change
  useEffect(() => {
    if (selectedImages.length === 0) {
      // Remove all image nodes, keep prompt nodes
      setRfNodes((prev) => prev.filter((n) => n.type !== "imageNode"));
      return;
    }

    const positions = getImageNodePositions(selectedImages.length);

    const newImageNodes: Node[] = selectedImages.map((image, i) => {
      let hostname: string | undefined;
      try {
        if (image.source_ref) hostname = new URL(image.source_ref).hostname;
      } catch {
        hostname = undefined;
      }

      return {
        id: `img-${image.id}`,
        type: "imageNode",
        position: positions[i],
        data: {
          imageId: image.id,
          storagePath: image.storage_path,
          sourceRef: image.source_ref,
          imageIndex: i,
          hostname,
        },
        draggable: true,
      };
    });

    setRfNodes((prev) => {
      const nonImageNodes = prev.filter((n) => n.type !== "imageNode");
      return [...newImageNodes, ...nonImageNodes];
    });
  }, [selectedImages, setRfNodes]);

  // Sync prompt nodes + edges into React Flow when promptNodes change
  useEffect(() => {
    const newPromptNodes: Node[] = promptNodes.map((pn) => ({
      id: pn.id,
      type: "promptNode",
      position: pn.position,
      data: {
        content: pn.content,
        mode: pn.mode,
        instruction: pn.instruction,
      },
      selected: pn.id === selectedNodeId,
      draggable: true,
    }));

    setRfNodes((prev) => {
      const imageNodes = prev.filter((n) => n.type === "imageNode");
      return [...imageNodes, ...newPromptNodes];
    });

    // Build edges
    const edges: Edge[] = [];

    // Edges from image nodes to root prompt nodes (those with no parent)
    const rootPromptNodes = promptNodes.filter((n) => n.parentId === null);
    rootPromptNodes.forEach((pn) => {
      pn.imageIds.forEach((imgId) => {
        const imageNodeId = `img-${imgId}`;
        edges.push({
          id: `edge-img-${imgId}-${pn.id}`,
          source: imageNodeId,
          target: pn.id,
          type: "smoothstep",
          animated: isGenerating,
          style: { stroke: "#d1d5db", strokeWidth: 1.5 },
        });
      });
    });

    // Edges from parent prompt nodes to children
    promptNodes
      .filter((n) => n.parentId !== null)
      .forEach((pn) => {
        edges.push({
          id: `edge-${pn.parentId}-${pn.id}`,
          source: pn.parentId!,
          target: pn.id,
          type: "smoothstep",
          animated: isGenerating,
          style: { stroke: "#d1d5db", strokeWidth: 1.5 },
        });
      });

    setRfEdges(edges);
  }, [promptNodes, selectedNodeId, isGenerating, setRfNodes, setRfEdges]);

  // Auto-collapse panel when a node is selected
  useEffect(() => {
    if (selectedNodeId !== null) {
      setPanelOpen(false);
    } else {
      setPanelOpen(true);
    }
  }, [selectedNodeId]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "promptNode") {
        selectNode(node.id);
      }
    },
    [selectNode]
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const imagePrompts = selectedImages.map((image, index) => ({
        imageIndex: index,
        imageId: image.id,
        jsonPrompt: image.prompts?.[0]?.json_prompt || {},
      }));

      let body: Record<string, unknown>;

      if (floatingBarMode === "generate") {
        body = {
          mode: "generate",
          instruction,
          imagePrompts,
          components: promptComponents,
          imageIds: selectedImages.map((i) => i.id),
          apiKey: settings?.secondaryLlmApiKey || settings?.geminiApiKey,
          systemPrompt: settings?.remixSystemPrompt,
        };
      } else if (floatingBarMode === "edit") {
        body = {
          mode: "edit",
          instruction,
          selectedPrompt: selectedNode?.content,
          apiKey: settings?.secondaryLlmApiKey || settings?.geminiApiKey,
        };
      } else {
        body = {
          mode: "duplicate",
          instruction,
          selectedPrompt: selectedNode?.content,
          count: duplicateCount,
          apiKey: settings?.secondaryLlmApiKey || settings?.geminiApiKey,
        };
      }

      const response = await fetch("/api/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setGenerationError(
          response.status === 429
            ? "Rate limit exceeded. Please wait a moment and try again."
            : data.error || "Generation failed. Please try again."
        );
        return;
      }

      const prompts: string[] = data.prompts || (data.prompt ? [data.prompt] : []);
      const now = new Date().toISOString();
      const parentId = floatingBarMode !== "generate" ? (selectedNodeId ?? null) : null;
      const imageIds = selectedImages.map((i) => i.id);

      const newNodes: PromptTreeNode[] = prompts.map((content, i) => ({
        id: `node-${Date.now()}-${i}`,
        content,
        mode: floatingBarMode,
        instruction,
        imageIds,
        parentId,
        position: { x: 0, y: 0 }, // layoutTree will reposition
        createdAt: now,
      }));

      await handleGenerationComplete(newNodes);
      setInstruction("");
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationError("Failed to connect to the API. Please check your settings.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex flex-1 pl-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </main>
      </div>
    );
  }

  if (showRemixList) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-64">
          <div className="border-b border-gray-200 bg-white px-6 py-4">
            <h1 className="text-lg font-semibold text-gray-900">Playground</h1>
            <p className="text-sm text-gray-500">Mix and remix prompts from multiple images</p>
          </div>
          <div className="p-6">
            <RemixList
              onCreateNew={() => {
                setShowRemixList(false);
                setShowImageModal(true);
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Content area (after 64px sidebar) */}
      <div className="flex flex-1 flex-col overflow-hidden pl-64">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
          <button
            onClick={() => setShowRemixList(true)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronDown className="h-4 w-4 rotate-90" />
            All Remixes
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <RemixControls
            remixId={currentRemixId}
            remixName={remixName}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={autoSave}
            onSaveAsNew={saveAsNew}
            onClear={clearAll}
            onNameChange={setRemixName}
          />
        </div>

        {/* Main area: left panel + canvas */}
        <div className="relative flex flex-1 overflow-hidden">
          <LeftPanel
            open={panelOpen}
            onToggle={() => setPanelOpen((v) => !v)}
            images={selectedImages}
            components={promptComponents}
            onAddClick={() => setShowImageModal(true)}
            onRemoveImage={removeImage}
            onRemoveComponent={removeComponent}
          />

          {/* React Flow canvas */}
          <div ref={reactFlowRef} className="flex-1 bg-gray-50">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                color="#e5e7eb"
                size={1}
              />
              <Controls position="bottom-right" />
            </ReactFlow>

            {/* Empty state overlay */}
            {selectedImages.length === 0 && promptNodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">
                    Select images to get started
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Images will appear as nodes on the canvas
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating bar */}
      <FloatingBar
        mode={floatingBarMode}
        onModeChange={setFloatingBarMode}
        selectedNode={selectedNode ? { id: selectedNode.id, content: selectedNode.content } : null}
        onDeselectNode={() => selectNode(null)}
        instruction={instruction}
        onInstructionChange={setInstruction}
        duplicateCount={duplicateCount}
        onDuplicateCountChange={setDuplicateCount}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        panelOpen={panelOpen}
        error={generationError}
        onClearError={() => setGenerationError(null)}
        mentionImages={selectedImages.map((_, i): MentionImage => ({
          label: getImageLabel(i),
          hex: getImageColor(i).hex,
          index: i,
        }))}
      />

      <ImageSelectionModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onConfirm={addImages}
        initialSelectedIds={selectedImages.map((i) => i.id)}
      />
    </div>
  );
}

export function PlaygroundContent(props: PlaygroundContentProps) {
  return (
    <ReactFlowProvider>
      <PlaygroundCanvas {...props} />
    </ReactFlowProvider>
  );
}
