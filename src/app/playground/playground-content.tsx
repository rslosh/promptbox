"use client";

import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSelectionModal } from "@/components/playground/image-selection-modal";
import { SelectedImages } from "@/components/playground/selected-images";
import { PromptComponents } from "@/components/playground/prompt-components";
import { RemixControls } from "@/components/playground/remix-controls";
import { RemixList } from "@/components/playground/remix-list";
import { usePlaygroundState } from "@/hooks/use-playground-state";
import { copyToClipboard } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

interface Settings {
  geminiApiKey: string;
  secondaryLlmApiKey: string;
  geminiSystemPrompt: string;
  remixSystemPrompt: string;
}

interface PlaygroundContentProps {
  remixId?: string;
  initialImageIds?: string[];
}

export function PlaygroundContent({
  remixId,
  initialImageIds,
}: PlaygroundContentProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showRemixList, setShowRemixList] = useState(!remixId && !initialImageIds?.length);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load settings from localStorage
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

  const {
    remixId: currentRemixId,
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
    saveAsNew,
    autoSave,
    handleGenerationComplete,
  } = usePlaygroundState({
    initialRemixId: remixId,
    initialImageIds,
  });

  async function handleGenerate() {
    if (promptComponents.length === 0 && !editInstructions.trim()) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Build full JSON prompts for each image
      const imagePrompts = selectedImages.map((image, index) => ({
        imageIndex: index,
        imageId: image.id,
        jsonPrompt: image.prompts?.[0]?.json_prompt || {},
      }));

      const response = await fetch("/api/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          components: promptComponents,
          instructions: editInstructions,
          imageIds: selectedImages.map((i) => i.id),
          imagePrompts,
          apiKey: settings?.secondaryLlmApiKey || settings?.geminiApiKey,
          systemPrompt: settings?.remixSystemPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setGenerationError("Rate limit exceeded. Please wait a moment and try again.");
        } else {
          setGenerationError(data.error || "Generation failed. Please try again.");
        }
        return;
      }

      await handleGenerationComplete(data.prompt);
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationError("Failed to connect to the API. Please check your settings.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    const success = await copyToClipboard(generatedPrompt);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(_audioBlob: Blob) {
    // In a real implementation, this would send to a transcription API
    setEditInstructions((prev) => prev + " [Voice input would appear here]");
  }

  function restoreFromHistory(prompt: string) {
    setGeneratedPrompt(prompt);
    setShowHistory(false);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-64">
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        </main>
      </div>
    );
  }

  // Show remix list view
  if (showRemixList) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-64">
          <Header
            title="Playground"
            description="Mix and remix prompts from multiple images"
          />
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
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-64">
        <Header
          title="Playground"
          description="Mix and remix prompts from multiple images"
        />

        <div className="p-6">
          {/* Remix controls bar */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRemixList(true);
                }}
                className="text-white/60 hover:text-white"
              >
                <ChevronDown className="mr-1 h-4 w-4 rotate-90" />
                All Remixes
              </Button>
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
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Selected images and prompt components */}
            <div className="space-y-4">
              <SelectedImages
                images={selectedImages}
                onAddClick={() => setShowImageModal(true)}
                onRemoveImage={removeImage}
              />

              <PromptComponents
                components={promptComponents}
                onRemoveComponent={removeComponent}
              />
            </div>

            {/* Center: Edit instructions */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Remix Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="e.g., 'Take the subject from Image 1 and place it in the environment from Image 2 with the lighting style of Image 3...'"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    rows={6}
                  />

                  {/* Error message */}
                  {generationError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-300">{generationError}</p>
                        <button
                          onClick={() => setGenerationError(null)}
                          className="mt-1 text-xs text-red-400 hover:text-red-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant={isRecording ? "destructive" : "outline"}
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="mr-2 h-4 w-4" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-4 w-4" />
                          Voice
                        </>
                      )}
                    </Button>

                    <Button
                      className="flex-1"
                      onClick={handleGenerate}
                      disabled={
                        isGenerating ||
                        (promptComponents.length === 0 &&
                          !editInstructions.trim())
                      }
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* History */}
              {history.length > 0 && (
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        History ({history.length})
                      </CardTitle>
                      {showHistory ? (
                        <ChevronUp className="h-4 w-4 text-white/40" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  </CardHeader>
                  {showHistory && (
                    <CardContent>
                      <div className="max-h-48 space-y-2 overflow-y-auto">
                        {history.map((prompt, index) => (
                          <button
                            key={index}
                            onClick={() => restoreFromHistory(prompt)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-left text-xs text-white/60 transition-colors hover:bg-white/10"
                          >
                            <p className="line-clamp-2">{prompt}</p>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>

            {/* Right: Generated prompt */}
            <div className="space-y-4">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Generated Prompt</CardTitle>
                  {generatedPrompt && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={handleCopy}>
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setGeneratedPrompt("")}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {generatedPrompt ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-black/50 p-4">
                        <p className="whitespace-pre-wrap text-sm text-white/80">
                          {generatedPrompt}
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy to Clipboard
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center">
                      <p className="text-center text-sm text-white/40">
                        Select images and provide instructions to generate a
                        prompt
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Image selection modal */}
      <ImageSelectionModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onConfirm={addImages}
        initialSelectedIds={selectedImages.map((i) => i.id)}
      />
    </div>
  );
}
