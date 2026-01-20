import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

interface PromptComponent {
  id: string;
  type: string;
  value: string;
  imageIndex: number;
  imageId: string;
}

interface ImagePromptData {
  imageIndex: number;
  imageId: string;
  jsonPrompt: Record<string, unknown>;
}

const DEFAULT_SYSTEM_PROMPT = `ROLE
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

export async function POST(request: NextRequest) {
  try {
    const { components, instructions, imageIds, apiKey, systemPrompt, imagePrompts } = await request.json();

    if (!imagePrompts?.length && !components?.length && !instructions?.trim()) {
      return NextResponse.json({ error: "No image data or instructions provided" }, { status: 400 });
    }

    // Use provided API key or env variable
    const geminiKey = apiKey || process.env.GEMINI_API_KEY || process.env.SECONDARY_LLM_API_KEY;
    
    if (!geminiKey) {
      return NextResponse.json({ error: "LLM API key not configured" }, { status: 400 });
    }

    // Format full JSON prompts from each image
    let sourcePromptsSection = "";
    
    if (imagePrompts && imagePrompts.length > 0) {
      // Use full JSON prompts (preferred)
      sourcePromptsSection = (imagePrompts as ImagePromptData[])
        .sort((a, b) => a.imageIndex - b.imageIndex)
        .map((img) => {
          const imageLabel = `Image ${img.imageIndex + 1}`;
          const jsonStr = JSON.stringify(img.jsonPrompt, null, 2);
          return `[${imageLabel}]\n${jsonStr}`;
        })
        .join("\n\n");
    } else if (components && components.length > 0) {
      // Fallback to component-based format
      const componentsByImage: Record<string, { type: string; value: string }[]> = {};
      (components as PromptComponent[]).forEach((c) => {
        const imgLabel = `Image ${c.imageIndex + 1}`;
        if (!componentsByImage[imgLabel]) {
          componentsByImage[imgLabel] = [];
        }
        componentsByImage[imgLabel].push({ type: c.type, value: c.value });
      });

      sourcePromptsSection = Object.entries(componentsByImage)
        .map(([imgLabel, comps]) => {
          const fields = comps.map((c) => `  "${c.type}": "${c.value}"`).join(",\n");
          return `[${imgLabel}]\n{\n${fields}\n}`;
        })
        .join("\n\n");
    }

    // Use custom system prompt or default
    const activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Build the user message with source prompts and remix request
    const userMessage = `SOURCE PROMPTS:

${sourcePromptsSection}

---

REMIX REQUEST:
${instructions || "Combine all elements from the source images into a single cohesive scene, preserving the best qualities of each."}

---

Generate the final prompt now:`;

    // Initialize Gemini with the new SDK
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Try primary model, fall back to alternatives if rate limited
    // Using current models per Gemini API guidelines (2025)
    const models = ["gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: userMessage,
          config: {
            systemInstruction: activeSystemPrompt,
          },
        });

        const generatedPrompt = (response.text || "").trim();

        return NextResponse.json({
          prompt: generatedPrompt,
          components: components.length,
          imageIds,
          model,
        });
      } catch (err) {
        lastError = err as Error;
        const errorMessage = (err as Error).message || "";
        
        // If rate limited or model not found, try next model
        if (
          errorMessage.includes("429") || 
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.includes("404") ||
          errorMessage.includes("NOT_FOUND")
        ) {
          console.log(`Error on ${model} (${errorMessage.includes("429") ? "rate limit" : "not found"}), trying next model...`);
          continue;
        }
        
        // For other errors, throw immediately
        throw err;
      }
    }

    // All models failed with rate limits
    console.error("All models rate limited:", lastError);
    return NextResponse.json(
      { 
        error: "API rate limit exceeded. Please wait a moment and try again, or check your API key billing settings.",
        retryAfter: 30
      }, 
      { status: 429 }
    );
  } catch (error) {
    console.error("Remix error:", error);
    const errorMessage = (error as Error).message || "";
    
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        { 
          error: "API rate limit exceeded. Please wait a moment and try again.",
          retryAfter: 30
        }, 
        { status: 429 }
      );
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
