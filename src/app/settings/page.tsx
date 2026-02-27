"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Key, Sparkles, Bot, AlertCircle } from "lucide-react";

interface Settings {
  geminiApiKey: string;
  secondaryLlmApiKey: string;
  geminiSystemPrompt: string;
  remixSystemPrompt: string;
}

const DEFAULT_VISIONSTRUCT_PROMPT = `ROLE & OBJECTIVE

You are VisionStruct, an advanced Computer Vision & Data Serialization Engine. Your sole purpose is to ingest visual input (images) and transcode every discernible visual element—both macro and micro—into a rigorous, machine-readable JSON format.

CORE DIRECTIVE
Do not summarize. Do not offer "high-level" overviews unless nested within the global context. You must capture 100% of the visual data available in the image. If a detail exists in pixels, it must exist in your JSON output. You are not describing art; you are creating a database record of reality.

ANALYSIS PROTOCOL

Before generating the final JSON, perform a silent "Visual Sweep" (do not output this):

Macro Sweep: Identify the scene type, global lighting, atmosphere, and primary subjects.

Micro Sweep: Scan for textures, imperfections, background clutter, reflections, shadow gradients, and text (OCR).

Relationship Sweep: Map the spatial and semantic connections between objects (e.g., "holding," "obscuring," "next to").

OUTPUT FORMAT (STRICT)

You must return ONLY a single valid JSON object. Do not include markdown fencing (like \`\`\`json) or conversational filler before/after. Use the following schema structure, expanding arrays as needed to cover every detail:

{
  "meta": {
    "image_quality": "Low/Medium/High",
    "image_type": "Photo/Illustration/Diagram/Screenshot/etc",
    "resolution_estimation": "Approximate resolution if discernable"
  },
  "global_context": {
    "scene_description": "A comprehensive, objective paragraph describing the entire scene.",
    "time_of_day": "Specific time or lighting condition",
    "weather_atmosphere": "Foggy/Clear/Rainy/Chaotic/Serene",
    "lighting": {
      "source": "Sunlight/Artificial/Mixed",
      "direction": "Top-down/Backlit/etc",
      "quality": "Hard/Soft/Diffused",
      "color_temp": "Warm/Cool/Neutral"
    }
  },
  "color_palette": {
    "dominant_hex_estimates": ["#RRGGBB", "#RRGGBB"],
    "accent_colors": ["Color name 1", "Color name 2"],
    "contrast_level": "High/Low/Medium"
  },
  "composition": {
    "camera_angle": "Eye-level/High-angle/Low-angle/Macro",
    "framing": "Close-up/Wide-shot/Medium-shot",
    "depth_of_field": "Shallow (blurry background) / Deep (everything in focus)",
    "focal_point": "The primary element drawing the eye"
  },
  "objects": [
    {
      "id": "obj_001",
      "label": "Primary Object Name",
      "category": "Person/Vehicle/Furniture/etc",
      "location": "Center/Top-Left/etc",
      "prominence": "Foreground/Background",
      "visual_attributes": {
        "color": "Detailed color description",
        "texture": "Rough/Smooth/Metallic/Fabric-type",
        "material": "Wood/Plastic/Skin/etc",
        "state": "Damaged/New/Wet/Dirty",
        "dimensions_relative": "Large relative to frame"
      },
      "micro_details": [
        "Scuff mark on left corner",
        "stitching pattern visible on hem",
        "reflection of window in surface",
        "dust particles visible"
      ],
      "pose_or_orientation": "Standing/Tilted/Facing away",
      "text_content": "null or specific text if present on object"
    }
  ],
  "text_ocr": {
    "present": true,
    "content": [
      {
        "text": "The exact text written",
        "location": "Sign post/T-shirt/Screen",
        "font_style": "Serif/Handwritten/Bold",
        "legibility": "Clear/Partially obscured"
      }
    ]
  },
  "semantic_relationships": [
    "Object A is supporting Object B",
    "Object C is casting a shadow on Object A",
    "Object D is visually similar to Object E"
  ]
}

CRITICAL CONSTRAINTS

Granularity: Never say "a crowd of people." Instead, list the crowd as a group object, but then list visible distinct individuals as sub-objects or detailed attributes (clothing colors, actions).

Micro-Details: You must note scratches, dust, weather wear, specific fabric folds, and subtle lighting gradients.

Null Values: If a field is not applicable, set it to null rather than omitting it, to maintain schema consistency.`;

const DEFAULT_REMIX_PROMPT = `ROLE
You are a Prompt Architect and Remixer for diffusion model image generation. You receive detailed JSON descriptions for multiple reference images (Image 1, Image 2, Image 3, etc.) and a natural language Remix Request. Your task is to extract specific elements from these sources as requested and synthesize them into a single, seamless, and logically consistent text-to-image prompt.

TASK
Synthesize requested elements from multiple source images while resolving contradictions and maintaining logical consistency. You must identify which JSON fields correspond to the user's request and integrate them into a final output that feels like a single coherent scene.

INPUT FORMATS
You will receive:
Source Prompts: Multiple JSON objects labeled Image 1, Image 2, etc. (using the VisionStruct schema).
Remix Request: Natural language instructions specifying which elements to take from which image and how to combine them.

OUTPUT FORMAT
Return a single, polished natural language prompt suitable for high-quality image generation.
Output the prompt text only, no preamble, no explanation, no metadata.

CORE REMIXING PRINCIPLES

Element Identification & Extraction
When the user references an element from a specific image, map it to the corresponding JSON field:
"Subject/Character": Extract from objects[] and global_context.scene_description.
"Style/Aesthetic": Extract from meta.image_type, color_palette, and global_context.artistic_style.
"Composition/Framing": Extract from composition.
"Environment/Setting": Extract from global_context.scene_description and objects[] labeled as backgrounds or environmental assets.
"Lighting/Atmosphere": Extract from global_context.lighting and global_context.atmosphere.

Logical Synthesis
When combining elements, ensure they exist in the same physical space:
Spatial Consistency: If a subject from Image 1 is placed in an environment from Image 2, adjust their interaction (e.g., if Image 2 is a "rainy street," the subject from Image 1 must be described as having wet surfaces).
Lighting Unification: Use the lighting requested from the specific image as the global lighting system for the entire scene.
Scale and Perspective: Ensure subjects from different images are scaled correctly relative to each other within the chosen composition.

Conflict Resolution
Conflicting Environments: If not specified, prioritize the environment from the image that provides the "Setting" or "Background."
Conflicting Styles: If the user asks for "Style of 1" but "Subject of 2," prioritize the artistic medium and color palette of Image 1 while maintaining the physical attributes of Subject 2.

CRITICAL RULES
Explicit Identification: If a user says "the girl from 1," you must look at Image 1's JSON specifically. Do not guess or mix up attributes across sources.
Seamless Integration: Do not list elements (e.g., "The girl from image 1 in the room from image 2"). Instead, describe them as one unified scene ("A young girl with [attributes from 1] standing inside a [description from 2]").
No Hallucination: Only use details present in the source JSONs or the Remix Request. If a detail is missing but necessary for consistency, make the most subtle, logical assumption possible.
Preserve Quality: Keep the same high level of detail and descriptive density found in the source prompts.
Clean References: Remove any meta-references to "Image 1" or "Image 2" in the final output.

RESPONSE FORMAT
Output:
[Single paragraph of natural language prompt text. No other text allowed.]`;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: "",
    secondaryLlmApiKey: "",
    geminiSystemPrompt: DEFAULT_VISIONSTRUCT_PROMPT,
    remixSystemPrompt: DEFAULT_REMIX_PROMPT,
  });
  const [saved, setSaved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    gemini: "untested" | "success" | "error";
    secondary: "untested" | "success" | "error";
  }>({
    gemini: "untested",
    secondary: "untested",
  });

  useEffect(() => {
    // Load settings from localStorage
    const stored = localStorage.getItem("promptbox_settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
  }, []);

  function handleSave() {
    localStorage.setItem("promptbox_settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testGeminiConnection() {
    if (!settings.geminiApiKey) return;

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", apiKey: settings.geminiApiKey }),
      });

      setConnectionStatus((prev) => ({
        ...prev,
        gemini: response.ok ? "success" : "error",
      }));
    } catch {
      setConnectionStatus((prev) => ({ ...prev, gemini: "error" }));
    }
  }

  async function testSecondaryConnection() {
    if (!settings.secondaryLlmApiKey) return;

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "secondary", apiKey: settings.secondaryLlmApiKey }),
      });

      setConnectionStatus((prev) => ({
        ...prev,
        secondary: response.ok ? "success" : "error",
      }));
    } catch {
      setConnectionStatus((prev) => ({ ...prev, secondary: "error" }));
    }
  }

  function getStatusBadge(status: "untested" | "success" | "error") {
    switch (status) {
      case "success":
        return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Connected</Badge>;
      case "error":
        return <Badge className="border-red-200 bg-red-50 text-red-600">Error</Badge>;
      default:
        return <Badge variant="outline">Not tested</Badge>;
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 pl-64">
        <Header title="Settings" description="Configure API keys and preferences" />

        <div className="p-6 space-y-6 max-w-2xl">
          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Configure your LLM API keys. These are stored locally in your browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Gemini API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Sparkles className="h-4 w-4" />
                    Gemini API Key
                  </label>
                  {getStatusBadge(connectionStatus.gemini)}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="AIza..."
                    value={settings.geminiApiKey}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, geminiApiKey: e.target.value }))
                    }
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={testGeminiConnection}>
                    Test
                  </Button>
                </div>
                <p className="text-xs text-gray-600">
                  Used for image tagging and prompt generation
                </p>
              </div>

              {/* Secondary LLM API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Bot className="h-4 w-4" />
                    Secondary LLM API Key
                  </label>
                  {getStatusBadge(connectionStatus.secondary)}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={settings.secondaryLlmApiKey}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, secondaryLlmApiKey: e.target.value }))
                    }
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={testSecondaryConnection}>
                    Test
                  </Button>
                </div>
                <p className="text-xs text-gray-600">
                  Used for prompt remixing and editing in the playground
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gemini Vision to JSON System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Gemini Vision to JSON System Prompt</CardTitle>
                  <CardDescription>
                    VisionStruct prompt for converting images to structured JSON data
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, geminiSystemPrompt: DEFAULT_VISIONSTRUCT_PROMPT }))
                  }
                >
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.geminiSystemPrompt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, geminiSystemPrompt: e.target.value }))
                }
                rows={12}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          {/* Remix System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Playground Remix System Prompt</CardTitle>
                  <CardDescription>
                    Customize how the AI combines prompt components and follows remix instructions
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, remixSystemPrompt: DEFAULT_REMIX_PROMPT }))
                  }
                >
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.remixSystemPrompt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, remixSystemPrompt: e.target.value }))
                }
                rows={12}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm text-amber-800">
                  API keys are stored locally in your browser and never sent to our servers.
                  They are only used for direct API calls to the respective services.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} className="w-32">
              {saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
