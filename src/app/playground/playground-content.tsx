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
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Sidebar } from "@/components/layout/sidebar";
import { ImageSelectionModal } from "@/components/playground/image-selection-modal";
import { RemixList } from "@/components/playground/remix-list";
import { RemixControls } from "@/components/playground/remix-controls";
import { LeftPanel } from "@/components/playground/left-panel";
import { FloatingBar, type MentionImage, type FloatingBarHandle } from "@/components/playground/floating-bar";
import { nodeTypes } from "@/components/playground/flow";
import { usePromptTree } from "@/hooks/use-prompt-tree";
import { getImageNodePositions } from "@/lib/playground-layout";
import { getImageColor, getImageLabel } from "@/lib/constants/colors";
import type { PromptTreeNode } from "@/lib/playground-types";
import { Loader2, ChevronDown, X, Copy, Check } from "lucide-react";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/remix-prompts";

interface Settings {
  geminiApiKey: string;
  secondaryLlmApiKey: string;
  remixSystemPrompt: string;
  editSystemPrompt: string;
}

interface PlaygroundContentProps {
  remixId?: string;
  initialImageIds?: string[];
}

interface RequestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  userMessage: string;
}

function RequestPreviewModal({ isOpen, onClose, systemPrompt, userMessage }: RequestPreviewModalProps) {
  const [tab, setTab] = useState<"system" | "user">("system");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeText = tab === "system" ? systemPrompt : userMessage;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">LLM Request Preview</h2>
            <p className="mt-0.5 text-xs text-gray-400">Exactly what is sent to the model on Generate</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-gray-100 px-5 pt-3">
          <button
            onClick={() => setTab("system")}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "system"
                ? "border border-b-0 border-gray-200 bg-white text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            System Prompt
          </button>
          <button
            onClick={() => setTab("user")}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "user"
                ? "border border-b-0 border-gray-200 bg-white text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            User Message
          </button>
        </div>

        {/* Content */}
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <pre className="p-5 font-mono text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
            {activeText || <span className="italic text-gray-400">No data yet — select images and enter an instruction first.</span>}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-5 py-3">
          <span className="text-[10px] text-gray-400">{activeText.length.toLocaleString()} characters</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
          >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [showPreview, setShowPreview] = useState(false);
  const floatingBarRef = useRef<FloatingBarHandle>(null);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const reactFlowRef = useRef<HTMLDivElement>(null);
  const initialFitDoneRef = useRef(false);
  const { fitView } = useReactFlow();

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

  // Sync prompt nodes into React Flow — preserves user-dragged positions.
  // Uses the functional setRfNodes form so we can read the current RF positions
  // (which include user drags) and only apply layout positions for NEW nodes.
  useEffect(() => {
    setRfNodes((prev) => {
      const imageNodes = prev.filter((n) => n.type === "imageNode");
      // Map of node id → current position in RF (includes user drags)
      const currentPositions = new Map<string, { x: number; y: number }>(
        prev.filter((n) => n.type === "promptNode").map((n) => [n.id, n.position])
      );
      const promptRfNodes: Node[] = promptNodes.map((pn) => ({
        id: pn.id,
        type: "promptNode",
        // Existing nodes keep their RF position; new nodes use the layout position
        position: currentPositions.get(pn.id) ?? pn.position,
        data: {
          content: pn.content,
          mode: pn.mode,
          instruction: pn.instruction,
          model: pn.model,
        },
        draggable: true,
      }));
      return [...imageNodes, ...promptRfNodes];
    });
  }, [promptNodes, setRfNodes]);

  // Sync selection separately — never touches positions, only flips `selected`
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.type === "promptNode" && n.id === selectedNodeId,
      }))
    );
  }, [selectedNodeId, setRfNodes]);

  // Sync edges
  useEffect(() => {
    const edges: Edge[] = [];

    // Edges from image nodes to root prompt nodes (those with no parent)
    const rootPromptNodes = promptNodes.filter((n) => n.parentId === null);
    rootPromptNodes.forEach((pn) => {
      pn.imageIds.forEach((imgId) => {
        edges.push({
          id: `edge-img-${imgId}-${pn.id}`,
          source: `img-${imgId}`,
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
  }, [promptNodes, isGenerating, setRfEdges]);

  // Fit view once when nodes first appear (initial load / first generate)
  useEffect(() => {
    if (initialFitDoneRef.current || rfNodes.length === 0) return;
    initialFitDoneRef.current = true;
    // Small delay so React Flow has time to measure node sizes
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    return () => clearTimeout(t);
  }, [rfNodes.length, fitView]);

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
          editSystemPrompt: settings?.editSystemPrompt,
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
      const model: string | undefined = data.model;

      const newNodes: PromptTreeNode[] = prompts.map((content, i) => ({
        id: `node-${Date.now()}-${i}`,
        content,
        mode: floatingBarMode,
        instruction,
        imageIds,
        parentId,
        position: { x: 0, y: 0 },
        createdAt: now,
        model,
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

  function buildUserMessage(): string {
    const imagePrompts = selectedImages.map((image, index) => ({
      imageIndex: index,
      imageId: image.id,
      jsonPrompt: image.prompts?.[0]?.json_prompt || {},
    }));

    let sourcePromptsSection = "";

    if (imagePrompts.length > 0) {
      sourcePromptsSection = imagePrompts
        .map((img) => `[Image ${img.imageIndex + 1}]\n${JSON.stringify(img.jsonPrompt, null, 2)}`)
        .join("\n\n");
    } else if (promptComponents.length > 0) {
      const byImage: Record<string, { type: string; value: string }[]> = {};
      promptComponents.forEach((c) => {
        const key = `Image ${c.imageIndex + 1}`;
        if (!byImage[key]) byImage[key] = [];
        byImage[key].push({ type: c.type, value: c.value });
      });
      sourcePromptsSection = Object.entries(byImage)
        .map(([label, comps]) => {
          const fields = comps.map((c) => `  "${c.type}": "${c.value}"`).join(",\n");
          return `[${label}]\n{\n${fields}\n}`;
        })
        .join("\n\n");
    }

    return `SOURCE PROMPTS:\n\n${sourcePromptsSection || "(none yet)"}\n\n---\n\nREMIX REQUEST:\n${instruction.trim() || "(no instruction yet)"}\n\n---\n\nGenerate the final prompt now:`;
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
            onInsertToken={(text) => floatingBarRef.current?.insertAtCursor(text)}
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
        ref={floatingBarRef}
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
        onShowPreview={() => setShowPreview(true)}
      />

      <RequestPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        systemPrompt={settings?.remixSystemPrompt || DEFAULT_SYSTEM_PROMPT}
        userMessage={buildUserMessage()}
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
