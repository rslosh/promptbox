import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Using untyped client for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VISIONSTRUCT_SYSTEM_INSTRUCTION = `ROLE & OBJECTIVE

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
      "text_content": null
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
  ],
  "natural_prompt": "A detailed natural language description suitable for AI image generation, capturing the essence of the image in vivid, specific language."
}

CRITICAL CONSTRAINTS

Granularity: Never say "a crowd of people." Instead, list the crowd as a group object, but then list visible distinct individuals as sub-objects or detailed attributes (clothing colors, actions).

Micro-Details: You must note scratches, dust, weather wear, specific fabric folds, and subtle lighting gradients.

Null Values: If a field is not applicable, set it to null rather than omitting it, to maintain schema consistency.

IMPORTANT: Always include a "natural_prompt" field at the root level containing a flowing, descriptive paragraph suitable for AI image generation.`;

export async function POST(request: NextRequest) {
  try {
    const { assetId, apiKey, systemPrompt } = await request.json();

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }

    // Get the asset
    const { data: asset, error: assetError } = await supabase
      .from("image_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Get the image from storage
    const { data: imageData, error: imageError } = await supabase.storage
      .from("image_assets")
      .download(asset.storage_path);

    if (imageError || !imageData) {
      return NextResponse.json({ error: "Failed to download image" }, { status: 500 });
    }

    // Convert to base64
    const buffer = Buffer.from(await imageData.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const mimeType = `image/${asset.format}`;

    // Use provided API key or env variable
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    
    if (!geminiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 });
    }

    // Initialize Gemini with the new SDK
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Analyze the image using the new API pattern with systemInstruction
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            {
              text: "Analyze this image and generate the complete JSON output.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt || VISIONSTRUCT_SYSTEM_INSTRUCTION,
      },
    });

    const text = response.text || "";

    // Parse the response
    let jsonPrompt: Record<string, unknown> = {};
    let naturalPrompt = "";

    try {
      // Try to extract JSON from the response
      // Remove any potential markdown fencing
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
      }
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      const parsed = JSON.parse(cleanedText);
      jsonPrompt = parsed;
      naturalPrompt = parsed.natural_prompt || parsed.global_context?.scene_description || "";
    } catch {
      // If parsing fails, try to find JSON in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          jsonPrompt = parsed;
          naturalPrompt = parsed.natural_prompt || parsed.global_context?.scene_description || "";
        } catch {
          // If still fails, use the raw text as natural prompt
          naturalPrompt = text;
          jsonPrompt = { raw_response: text };
        }
      } else {
        naturalPrompt = text;
        jsonPrompt = { raw_response: text };
      }
    }

    // Extract tags from the JSON prompt
    const tags: { tag: string; confidence: number }[] = [];
    
    // Extract from objects
    if (Array.isArray(jsonPrompt.objects)) {
      jsonPrompt.objects.forEach((obj: Record<string, unknown>, index: number) => {
        if (obj.label && typeof obj.label === "string") {
          tags.push({ tag: obj.label, confidence: 1.0 - index * 0.02 });
        }
        if (obj.category && typeof obj.category === "string") {
          tags.push({ tag: obj.category, confidence: 0.9 - index * 0.02 });
        }
      });
    }

    // Extract from composition
    const composition = jsonPrompt.composition as Record<string, unknown> | undefined;
    if (composition) {
      if (composition.camera_angle && typeof composition.camera_angle === "string") {
        tags.push({ tag: composition.camera_angle, confidence: 0.85 });
      }
      if (composition.framing && typeof composition.framing === "string") {
        tags.push({ tag: composition.framing, confidence: 0.85 });
      }
    }

    // Extract from global context
    const globalContext = jsonPrompt.global_context as Record<string, unknown> | undefined;
    if (globalContext) {
      if (globalContext.weather_atmosphere && typeof globalContext.weather_atmosphere === "string") {
        tags.push({ tag: globalContext.weather_atmosphere, confidence: 0.8 });
      }
      if (globalContext.time_of_day && typeof globalContext.time_of_day === "string") {
        tags.push({ tag: globalContext.time_of_day, confidence: 0.8 });
      }
    }

    // Extract from meta
    const meta = jsonPrompt.meta as Record<string, unknown> | undefined;
    if (meta) {
      if (meta.image_type && typeof meta.image_type === "string") {
        tags.push({ tag: meta.image_type, confidence: 0.95 });
      }
    }

    // Extract accent colors
    const colorPalette = jsonPrompt.color_palette as Record<string, unknown> | undefined;
    if (colorPalette && Array.isArray(colorPalette.accent_colors)) {
      colorPalette.accent_colors.forEach((color: unknown, index: number) => {
        if (typeof color === "string") {
          tags.push({ tag: color, confidence: 0.7 - index * 0.05 });
        }
      });
    }

    // Deduplicate tags
    const uniqueTags = tags.reduce((acc: typeof tags, tag) => {
      if (!acc.find(t => t.tag.toLowerCase() === tag.tag.toLowerCase())) {
        acc.push(tag);
      }
      return acc;
    }, []);

    // Save tags
    if (uniqueTags.length > 0) {
      // Delete existing tags
      await supabase.from("asset_tags").delete().eq("asset_id", assetId);
      
      // Insert new tags
      await supabase.from("asset_tags").insert(
        uniqueTags.map((t) => ({
          asset_id: assetId,
          tag: t.tag,
          confidence: t.confidence,
        }))
      );
    }

    // Save prompt
    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .insert({
        asset_id: assetId,
        json_prompt: jsonPrompt,
        natural_prompt: naturalPrompt,
        model_name: "gemini-3.1-flash-lite-preview",
        model_params: { 
          system_instruction: systemPrompt ? "custom" : "visionstruct",
        },
      })
      .select()
      .single();

    if (promptError) {
      console.error("Prompt save error:", promptError);
      return NextResponse.json({ error: "Failed to save prompt" }, { status: 500 });
    }

    // Create initial version
    await supabase.from("prompt_versions").insert({
      prompt_id: prompt.id,
      version_index: 1,
      json_prompt: jsonPrompt,
      natural_prompt: naturalPrompt,
      edit_source: "llm",
    });

    return NextResponse.json({
      message: "Tagging complete",
      prompt,
      tags: uniqueTags,
    });
  } catch (error) {
    console.error("Tagging error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
