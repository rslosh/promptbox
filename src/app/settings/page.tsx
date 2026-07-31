"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Key, Sparkles, Bot, AlertCircle, Wand2, Cpu } from "lucide-react";
import {
  VISIONSTRUCT_SYSTEM_INSTRUCTION as DEFAULT_VISIONSTRUCT_PROMPT,
  PROMPTFORGE_SYSTEM_INSTRUCTION as DEFAULT_PROMPTFORGE_PROMPT,
  SCENECOMPOSE_SYSTEM_INSTRUCTION as DEFAULT_SCENECOMPOSE_PROMPT,
  GEMINI_MODELS,
  VISION_MODEL,
  PROSE_MODEL,
  SCENE_MODEL,
} from "@/lib/tagger";

interface Settings {
  geminiApiKey: string;
  secondaryLlmApiKey: string;
  geminiSystemPrompt: string;
  geminiProsePrompt: string;
  geminiScenePrompt: string;
  visionModel: string;
  proseModel: string;
  sceneModel: string;
  remixSystemPrompt: string;
  editSystemPrompt: string;
  duplicateSystemPrompt: string;
}

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

const DEFAULT_EDIT_PROMPT = `# ROLE

You are a Prompt Editor for diffusion model image generation. You receive either a JSON image description or a natural language prompt, plus an edit request. You output the modified version with the edit applied.



# TASK

Apply the requested edit while maintaining logical consistency. Make reasonable assumptions about cascading changes.



# INPUT FORMATS

You will receive:

1. Current prompt (JSON format OR natural language text)

2. Edit request (natural language)



# OUTPUT FORMAT

Return the same format you received:

- If input was JSON → output modified JSON

- If input was text → output modified text



Apply the edit directly. Do not explain changes, do not add commentary.



# CORE EDITING PRINCIPLES



## Framing Changes

When user requests framing adjustments (closer, wider, tighter, pulled back):



**Closer framing:**

- Update framing descriptor (medium shot → close-up, etc.)

- Remove elements not visible in tighter framing (lower body, distant background)

- Add more facial/surface details that become visible

- Adjust depth of field (typically shallower when closer)



**Wider framing:**

- Update framing descriptor (close-up → medium shot, etc.)

- Add environmental context and full-body elements

- Reduce micro-detail density (too far to see fine details)

- Adjust depth of field (typically deeper when wider)



**Visibility by framing type:**

- Extreme close-up: Face only, often partial features

- Close-up: Head and shoulders

- Medium close-up: Head to chest

- Medium shot: Head to waist (no feet)

- Medium full shot: Head to knees

- Full shot: Entire body

- Wide shot: Body plus significant environment



## Subject Focus Changes

When user requests focus on different subject:

- Demote current primary subject (reduce detail, make contextual)

- Promote new subject (expand detail, make central)

- Update focal point references

- Adjust framing if needed to accommodate new subject



## Attribute Changes

When user changes specific attributes (color, material, lighting, etc.):

- Update the attribute directly

- Update any mentions in related descriptions (reflections, color harmony, etc.)

- Adjust lighting interaction descriptions if relevant



## Additions/Removals

When adding elements: Integrate naturally into appropriate sections

When removing elements: Delete and clean up any references to them



## Environmental Changes

Time of day, weather, atmosphere changes affect:

- Lighting system

- Visibility (night = reduced detail)

- Object states (rain = wet surfaces)

- Color temperature

- Atmospheric effects



# CRITICAL RULES



1. **Maintain logical consistency**: If framing gets tighter and shows head/shoulders only, pants and shoes cannot be visible.

2. **Make reasonable assumptions**: If user says "closer up", choose appropriate framing (close-up or medium close-up) based on current state.

3. **No hallucination**: Only modify what's necessary for the edit. Don't add unrelated details.

4. **Preserve quality**: Keep the same level of detail density and descriptive style as the input.

5. **Clean references**: If you remove an object, remove any mentions of it in spatial descriptions or relationships.



# RESPONSE FORMAT



**If input is JSON:**

Output valid JSON only, no markdown fencing, no explanatory text.



**If input is text:**

Output the modified prompt text only, no preamble, no explanation.`;

const DEFAULT_DUPLICATE_PROMPT = `# ROLE

You are a Prompt Variation Specialist for diffusion model image generation. You receive an image generation prompt and a variation instruction that names ONE specific element to vary. You output a modified version where ONLY that element changes.

# CORE PRINCIPLE

This is a surgical find-and-replace, not a creative rewrite.

- IDENTIFY the specific element named in the variation instruction (e.g. "jet model", "hair color", "lighting style")
- REPLACE only that element with a new version
- PRESERVE everything else — sentence structure, paragraph length, descriptive density, style, tone, all other subjects and their attributes

# WHAT TO CHANGE

Only the element explicitly named in the variation instruction. Make it distinct and meaningfully different from the original value of that element.

# WHAT NEVER TO CHANGE

- Sentence structure and paragraph organization
- Writing style and descriptive density
- All subjects, objects, and attributes NOT related to the varied element
- Composition, framing, camera angle
- Lighting and atmosphere (unless lighting IS the varied element)
- Background and environmental details (unless environment IS the varied element)
- Technical photography or art direction language

# CASCADING CHANGES (minimum necessary only)

Some element changes require small logical updates for consistency:
- Varying a vehicle model → update model name and any model-specific details that would be factually wrong for the new model (e.g. wing shape, engine type), nothing else
- Varying a color → update any mentions of that color in reflections, lighting interactions, or color harmony descriptions
- Varying a material → update texture and surface interaction descriptions for that object only

Make only the minimum cascading changes required. Do not use cascading changes as an excuse to rewrite other parts of the prompt.

# OUTPUT FORMAT

Return the modified prompt text only. Same length, same structure, same writing style as the input. No explanation, no preamble, no commentary.`;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: "",
    secondaryLlmApiKey: "",
    geminiSystemPrompt: DEFAULT_VISIONSTRUCT_PROMPT,
    geminiProsePrompt: DEFAULT_PROMPTFORGE_PROMPT,
    geminiScenePrompt: DEFAULT_SCENECOMPOSE_PROMPT,
    visionModel: VISION_MODEL,
    proseModel: PROSE_MODEL,
    sceneModel: SCENE_MODEL,
    remixSystemPrompt: DEFAULT_REMIX_PROMPT,
    editSystemPrompt: DEFAULT_EDIT_PROMPT,
    duplicateSystemPrompt: DEFAULT_DUPLICATE_PROMPT,
  });
  const [saved, setSaved] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    gemini: "untested" | "success" | "error";
    secondary: "untested" | "success" | "error";
  }>({
    gemini: "untested",
    secondary: "untested",
  });
  const [backfill, setBackfill] = useState<{
    status: "idle" | "running" | "done" | "error";
    mode: "missing" | "all" | null;
    remaining: number | null;
    total: number | null;
    processed: number;
    failed: number;
    message: string;
  }>({
    status: "idle",
    mode: null,
    remaining: null,
    total: null,
    processed: 0,
    failed: 0,
    message: "",
  });
  // How many of the most-recent prompts the "Re-run" overwrite flow touches.
  const [retagCount, setRetagCount] = useState(200);

  useEffect(() => {
    // Load settings from localStorage, merging with defaults so newly-added
    // fields populate for users who saved settings before the field existed.
    const stored = localStorage.getItem("promptbox_settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Drop any saved model IDs that are no longer offered (e.g. a model
        // that was renamed or retired). Falling back to the default avoids
        // 404s from a stale value persisted before the option list changed.
        const validModels = new Set<string>(GEMINI_MODELS.map((m) => m.value));
        const heal = (val: unknown, fallback: string) =>
          typeof val === "string" && validModels.has(val) ? val : fallback;
        parsed.visionModel = heal(parsed.visionModel, VISION_MODEL);
        parsed.proseModel = heal(parsed.proseModel, PROSE_MODEL);
        parsed.sceneModel = heal(parsed.sceneModel, SCENE_MODEL);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const t = setTimeout(() => {
      localStorage.setItem("promptbox_settings", JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 300);
    return () => clearTimeout(t);
  }, [settings, isLoaded]);

  // Show how many prompts are missing an Ideogram (scene) prompt, and the
  // total — used by the missing-fill and overwrite-all actions respectively.
  useEffect(() => {
    fetch("/api/backfill-scene")
      .then((r) => r.json())
      .then((d) => {
        setBackfill((p) => ({
          ...p,
          remaining: typeof d.remaining === "number" ? d.remaining : p.remaining,
          total: typeof d.total === "number" ? d.total : p.total,
        }));
      })
      .catch(() => {});
  }, []);

  async function runBackfill(mode: "missing" | "all" = "missing") {
    if (backfill.status === "running") return;
    // For the overwrite flow, only touch the most-recent N prompts.
    const cap = mode === "all" ? Math.max(1, retagCount || 1) : null;
    if (
      mode === "all" &&
      !window.confirm(
        `Re-run the Ideogram (SceneCompose) pass for the ${cap} most recent prompt(s)? ` +
          `This overwrites their existing Ideogram JSON and cannot be undone.`
      )
    ) {
      return;
    }

    setBackfill((p) => ({
      ...p,
      status: "running",
      mode,
      processed: 0,
      failed: 0,
      message: "Starting…",
    }));

    let processed = 0;
    let failed = 0;
    let offset = 0;
    const noun = mode === "all" ? "Re-tagged" : "Backfilled";
    try {
      // Drive the work batch by batch until the server reports it's done.
      // "all" mode walks newest-first via an offset; "missing" mode shrinks as
      // rows get populated.
      while (true) {
        const res = await fetch("/api/backfill-scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: settings.geminiApiKey,
            scenePrompt: settings.geminiScenePrompt,
            sceneModel: settings.sceneModel,
            limit: 5,
            mode,
            offset,
            cap,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Re-tagging failed (${res.status})`);
        }
        const data: {
          succeeded: number;
          failed: number;
          offset?: number;
          remaining: number;
          done: boolean;
        } = await res.json();
        processed += data.succeeded;
        failed += data.failed;
        if (typeof data.offset === "number") offset = data.offset;
        setBackfill((p) => ({
          ...p,
          status: "running",
          remaining: data.remaining,
          processed,
          failed,
          message: `${noun} ${processed} · ${data.remaining} remaining`,
        }));
        if (data.done) break;
        // In "missing" mode, no progress means the rest can't be processed.
        // In "all" mode the offset always advances, so we keep going.
        if (mode === "missing" && data.succeeded === 0) {
          throw new Error(`Stopped — ${data.remaining} prompt(s) could not be processed`);
        }
      }
      setBackfill((p) => ({
        ...p,
        status: "done",
        remaining: 0,
        message: `Done — ${noun.toLowerCase()} ${processed} prompt(s)${failed ? `, ${failed} failed` : ""}`,
      }));
    } catch (error) {
      setBackfill((p) => ({
        ...p,
        status: "error",
        message: error instanceof Error ? error.message : "Re-tagging failed",
      }));
    }
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
      
      <main className="flex-1 pl-60">
        <Header title="Settings" description="Configure API keys and preferences" />

        <div className="p-6 space-y-6 max-w-2xl">
          <div className="flex h-5 items-center text-xs text-tertiary">
            {saved ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            ) : (
              <span>Changes save automatically</span>
            )}
          </div>
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
                  <label className="flex items-center gap-2 text-sm font-medium text-primary">
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
                <p className="text-xs text-secondary">
                  Used for image tagging and prompt generation
                </p>
              </div>

              {/* Secondary LLM API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-primary">
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
                <p className="text-xs text-secondary">
                  Used for prompt remixing and editing in the playground
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Prompt Models */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Auto-Prompt Models
              </CardTitle>
              <CardDescription>
                Choose which Gemini model runs each pass of auto-tagging. Flash is fast and cheap;
                Pro is slower but higher quality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primary">
                  VisionStruct (image → JSON)
                </label>
                <select
                  value={settings.visionModel}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, visionModel: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-primary focus:bg-input-focus focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primary">
                  PromptForge (natural-language prose)
                </label>
                <select
                  value={settings.proseModel}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, proseModel: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-primary focus:bg-input-focus focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primary">
                  Ideogram / SceneCompose (scene JSON)
                </label>
                <select
                  value={settings.sceneModel}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, sceneModel: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-primary focus:bg-input-focus focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Backfill Ideogram (scene) prompts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Ideogram Prompts
              </CardTitle>
              <CardDescription>
                Re-runs the Ideogram (scene composition) pass — analyzes each prompt&apos;s image
                with one Gemini call, no full re-tagging. <strong>Backfill</strong> only fills
                prompts that are missing it; <strong>Re-run Recent</strong> regenerates the newest N
                prompts, overwriting their existing Ideogram JSON.
                {backfill.total !== null && <> ({backfill.total} total)</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => runBackfill("missing")}
                  disabled={backfill.status === "running" || !settings.geminiApiKey}
                >
                  {backfill.status === "running" && backfill.mode === "missing"
                    ? "Backfilling…"
                    : "Backfill Missing"}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => runBackfill("all")}
                    disabled={backfill.status === "running" || !settings.geminiApiKey}
                  >
                    {backfill.status === "running" && backfill.mode === "all"
                      ? "Re-running…"
                      : "Re-run Recent"}
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={retagCount}
                    onChange={(e) => setRetagCount(Number(e.target.value))}
                    disabled={backfill.status === "running"}
                    className="w-24"
                    aria-label="Number of most-recent prompts to re-tag"
                  />
                </div>
                {backfill.remaining !== null && backfill.status !== "done" && backfill.status !== "running" && (
                  <span className="text-sm text-secondary">
                    {backfill.remaining} missing
                  </span>
                )}
              </div>
              {backfill.message && (
                <p
                  className={`text-xs ${
                    backfill.status === "error"
                      ? "text-red-600"
                      : backfill.status === "done"
                        ? "text-emerald-600"
                        : "text-secondary"
                  }`}
                >
                  {backfill.message}
                </p>
              )}
              {!settings.geminiApiKey && (
                <p className="text-xs text-tertiary">
                  Add your Gemini API key above to enable backfill.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Gemini Vision to JSON System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Gemini Vision to JSON System Prompt</CardTitle>
                  <CardDescription>
                    VisionStruct — pass 1 of auto-tagging. Converts images to structured JSON.
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

          {/* Natural Prompt System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Natural Prompt System Prompt</CardTitle>
                  <CardDescription>
                    PromptForge — pass 2 of auto-tagging. Receives the image + VisionStruct JSON and writes the natural-language prose prompt.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, geminiProsePrompt: DEFAULT_PROMPTFORGE_PROMPT }))
                  }
                >
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.geminiProsePrompt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, geminiProsePrompt: e.target.value }))
                }
                rows={12}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          {/* Ideogram / SceneCompose System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Ideogram (Scene Composition) System Prompt</CardTitle>
                  <CardDescription>
                    SceneCompose — pass 3 of auto-tagging. Reformats the VisionStruct JSON into the
                    render-ready scene composition document.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, geminiScenePrompt: DEFAULT_SCENECOMPOSE_PROMPT }))
                  }
                >
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.geminiScenePrompt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, geminiScenePrompt: e.target.value }))
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

          {/* Duplicate System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Playground Duplicate System Prompt</CardTitle>
                  <CardDescription>
                    Controls how the AI generates variations — should vary only the named element while preserving everything else
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, duplicateSystemPrompt: DEFAULT_DUPLICATE_PROMPT }))
                  }
                >
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.duplicateSystemPrompt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, duplicateSystemPrompt: e.target.value }))
                }
                rows={12}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          {/* Edit System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Playground Edit System Prompt</CardTitle>
                  <CardDescription>
                    Controls how the AI applies targeted edits to an existing prompt
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, editSystemPrompt: DEFAULT_EDIT_PROMPT }))
                  }
                >
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.editSystemPrompt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, editSystemPrompt: e.target.value }))
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

        </div>
      </main>
    </div>
  );
}
