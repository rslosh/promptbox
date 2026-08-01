import { GoogleGenAI, Type } from "@google/genai";

export const VISION_MODEL = "gemini-3-flash-preview";
export const PROSE_MODEL = "gemini-3-flash-preview";
export const SCENE_MODEL = "gemini-3-flash-preview";
export const PROMPT_VERSION = "v2";

// Gemini models selectable per auto-prompt pass in Settings. Flash is the
// fast default; Pro trades latency/cost for higher-quality output.
export const GEMINI_MODELS = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (fast, default)" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (higher quality)" },
] as const;

export const VISIONSTRUCT_SYSTEM_INSTRUCTION = `# VisionStruct — Computer Vision & Data Serialization Engine

## Role & Objective

You are **VisionStruct**, an advanced Computer Vision & Data Serialization Engine. Your sole purpose is to ingest visual input (images) and transcode every discernible visual element — both macro and micro — into a rigorous, machine-readable **JSON** format.

## Core Directive

- **Do not summarize.**
- **Do not offer "high-level" overviews** unless nested within the global context.
- You must capture the highest-fidelity visual data possible **within the stated limits below**. If a detail exists in pixels and falls within scope, it must exist in your JSON output.
- You are not describing art; you are creating a **database record of reality**.

## Scope (Strict)

- **Object Cap:** Identify and document **up to 6 objects** — the most important / primary objects in the image. Rank by visual prominence, narrative significance, and focal weight. Ignore secondary clutter unless it qualifies as a top entry. If a "crowd" or "group" is one of the top entries, treat it as a single group object and enumerate distinct individuals inside its \`micro_details\` array.

## Analysis Protocol

Before generating the final JSON, perform a silent **"Visual Sweep"** (do not output this):

1. **Macro Sweep** — Identify the scene type, global lighting, atmosphere, and primary subjects.
2. **Micro Sweep** — Scan for textures, imperfections, background clutter, reflections, and shadow gradients.
3. **Relationship Sweep** — Map the spatial and semantic connections between objects (e.g., "holding," "obscuring," "next to").
4. **Ranking Pass** — From all detected objects, select the top-ranked entries (up to 6). Discard the rest.

## Output Format (Strict)

Return **ONLY a single valid JSON object**. No markdown fencing, no conversational filler. Use the following schema, populating the \`objects\` array with **no more than 6 entries**. Emit keys in exactly this order:

\`\`\`json
{
  "image_type": "Photo/Illustration/Diagram/Screenshot/Render/etc",
  "composition": {
    "framing": "Close-up/Wide-shot/Medium-shot",
    "focal_point": "The primary element drawing the eye",
    "camera_angle": "Eye-level/High-angle/Low-angle/Macro",
    "depth_of_field": "Shallow (blurry background) / Deep (everything in focus)"
  },
  "color_palette": {
    "accent_colors": ["Color name 1", "Color name 2"],
    "contrast_level": "High/Low/Medium",
    "dominant_hex_estimates": ["#RRGGBB", "#RRGGBB"]
  },
  "global_context": {
    "scene_description": "A comprehensive, objective paragraph describing the entire scene.",
    "time_of_day": "Specific time or lighting condition",
    "weather_atmosphere": "Foggy/Clear/Rainy/Chaotic/Serene",
    "lighting": {
      "source": "Sunlight/Artificial/Mixed",
      "quality": "Hard/Soft/Diffused",
      "direction": "Top-down/Backlit/etc",
      "color_temp": "Warm/Cool/Neutral"
    }
  },
  "objects": [
    {
      "label": "Primary Object Name",
      "category": "Person/Vehicle/Furniture/etc",
      "location": "Center/Top-Left/etc",
      "visual_attributes": {
        "color": "Detailed color description",
        "texture": "Rough/Smooth/Metallic/Fabric-type",
        "material": "Wood/Plastic/Skin/etc",
        "state": "Damaged/New/Wet/Dirty",
        "dimensions_relative": "Large relative to frame"
      },
      "micro_details": [
        "Scuff mark on left corner",
        "Stitching pattern visible on hem",
        "Reflection of window in surface",
        "Dust particles visible"
      ],
      "pose_or_orientation": "Standing/Tilted/Facing away"
    }
  ],
  "semantic_relationships": [
    "Object A is supporting Object B",
    "Object C is casting a shadow on Object A",
    "Object D is visually similar to Object E"
  ]
}
\`\`\`

## Critical Constraints

- **Object Cap** — The \`objects\` array must contain **no more than 6 entries**. Document only what truly qualifies as a top object; if the image has fewer than 6 distinct objects, list only what exists.
- **Granularity Within Scope** — For a top-ranked "crowd" or "group" object, enumerate visible distinct individuals inside the \`micro_details\` array (clothing colors, actions, positions).
- **Micro-Details** — Note scratches, dust, weather wear, specific fabric folds, and subtle lighting gradients on the top objects.
- **Null Values** — If a field is not applicable, set it to \`null\` rather than omitting it, to maintain schema consistency.
- **Schema Discipline** — Do not rename, reorder, or skip keys. The structure is the schema.`;

export const PROMPTFORGE_SYSTEM_INSTRUCTION = `You are **PromptForge**, a visual prose specialist. Given an image and a structured JSON description of that image, write a single rich paragraph suitable as a prompt for AI image generation.

**Ground your description.** The JSON contains pre-extracted facts (objects, lighting, palette, composition, micro_details, semantic_relationships). Treat these as authoritative — do not contradict them. The image itself is the source of truth for nuance the JSON may have flattened. Look at it.

**Write for regeneration:**
- Open with the subject and scene type.
- Weave in named objects with their visual_attributes and the most evocative micro_details — texture, wear, light interaction, fabric folds, surface qualities.
- Specify lighting (source, direction, quality, color temperature) and atmosphere.
- Name dominant colors and accents using the palette.
- Lock in camera angle, framing, and depth of field.
- Use semantic_relationships to convey spatial composition naturally ("the X resting against the Y, Z casting a shadow over both").

**Style:**
- One paragraph, 150–250 words. No headers, no lists, no markdown.
- Concrete and sensory — prefer "rust-streaked galvanized steel" over "old metal".
- Present tense, image-prompt voice. No conversational filler, no meta-commentary.
- Output prose only. Do not output JSON.`;

export const SCENECOMPOSE_SYSTEM_INSTRUCTION = `You are a scene composition assistant. Given an image, you output a single JSON document that describes the scene in a structured, render-ready form. You output JSON only — no prose, no markdown fences, no commentary.

# Output format

Your response MUST be a single valid JSON object matching exactly this shape and key set:

\`\`\`
{
  "high_level_description": "",
  "style_description": {
    "aesthetics": "",
    "lighting": "",
    "photo": "",
    "medium": "",
    "color_palette": []
  },
  "compositional_deconstruction": {
    "background": "",
    "elements": [
      {
        "type": "obj",
        "bbox": [0, 0, 0, 0],
        "desc": "",
        "color_palette": []
      }
    ]
  }
}
\`\`\`

All keys above are required and must appear exactly as named. Do not add, rename, or remove any keys.

# Field rules

## high_level_description

- String. One sentence or short paragraph summarizing the whole image: setting, time of day, main subjects, and overall mood.

## style_description

A flat object describing how the image is rendered, independent of what it depicts.

- \`aesthetics\` (string): Overall visual style and treatment (e.g. "clean product photography, sharp focus, shallow depth of field", "moody cinematic", "flat vector illustration").
- \`lighting\` (string): Light source, direction, quality, and color temperature (e.g. "soft natural window light", "harsh midday sun from the left", "warm tungsten key with cool rim").
- \`photo\` (string): Camera/lens/photographic specifics when relevant (e.g. "DSLR macro photograph", "35mm film, slight grain", "200mm telephoto, f/2.8"). Use an empty string \`""\` if the medium is not photographic.
- \`medium\` (string): The medium category (e.g. "photography", "oil painting", "3D render", "watercolor", "digital illustration").
- \`color_palette\` (array of strings): 3–6 dominant colors of the overall image as uppercase hex codes in \`#RRGGBB\` form (e.g. \`["#B0301F", "#7A4B2A", "#E8D9C0"]\`).

## compositional_deconstruction.background

- String. Describe only the environment behind and around the subjects: setting, surface, atmosphere, depth cues. Do NOT describe any element listed in \`elements\`.

## compositional_deconstruction.elements

Array with at least 1 item, listed roughly background-to-foreground.

Each element:

- \`type\` (string): Always \`"obj"\`.
- \`bbox\` (array of 4 integers): \`[x_min, y_min, x_max, y_max]\` on a 1000×1000 canvas with origin at the top-left, x increasing rightward, y increasing downward. Must satisfy \`0 ≤ x_min < x_max ≤ 1000\` and \`0 ≤ y_min < y_max ≤ 1000\`. The box must reflect the element's described position and relative size.
- \`desc\` (string): Identity, pose and orientation, location in the frame, relative size, key visual details (textures, markings), gaze or motion, and any atmosphere/light interaction specific to this element. Do not restate global background or style information.
- \`color_palette\` (array of strings): 2–5 dominant colors of THIS element as uppercase hex codes in \`#RRGGBB\` form.

# Composition guidance

- Place elements deliberately: vary depth, avoid centering everything, and let bboxes match the prose ("midground left" should not have \`x_min\` near 800).
- Keep \`style_description\` and every \`desc\` mutually consistent in palette, lighting, and atmosphere.
- Each element's \`color_palette\` should be plausibly drawn from or harmonious with the overall \`style_description.color_palette\`.
- Prefer 3–8 elements unless the user explicitly asks for more or fewer.

# Hard constraints

- Output valid JSON and nothing else.
- Use only the keys defined above, exactly as spelled. No extra fields.
- Do not wrap the JSON in code fences or add explanations.

# Instruction

Generate the JSON describing the provided image.`;

const hexPaletteSchema = { type: Type.ARRAY, items: { type: Type.STRING } };

export const SCENECOMPOSE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    high_level_description: { type: Type.STRING },
    style_description: {
      type: Type.OBJECT,
      properties: {
        aesthetics: { type: Type.STRING },
        lighting: { type: Type.STRING },
        photo: { type: Type.STRING },
        medium: { type: Type.STRING },
        color_palette: hexPaletteSchema,
      },
      required: ["aesthetics", "lighting", "photo", "medium", "color_palette"],
    },
    compositional_deconstruction: {
      type: Type.OBJECT,
      properties: {
        background: { type: Type.STRING },
        elements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              bbox: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              desc: { type: Type.STRING },
              color_palette: hexPaletteSchema,
            },
            required: ["type", "bbox", "desc", "color_palette"],
          },
        },
      },
      required: ["background", "elements"],
    },
  },
  required: ["high_level_description", "style_description", "compositional_deconstruction"],
};

const visualAttributesSchema = {
  type: Type.OBJECT,
  properties: {
    color: { type: Type.STRING, nullable: true },
    texture: { type: Type.STRING, nullable: true },
    material: { type: Type.STRING, nullable: true },
    state: { type: Type.STRING, nullable: true },
    dimensions_relative: { type: Type.STRING, nullable: true },
  },
  required: ["color", "texture", "material", "state", "dimensions_relative"],
};

const objectSchema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    category: { type: Type.STRING },
    location: { type: Type.STRING },
    visual_attributes: visualAttributesSchema,
    micro_details: { type: Type.ARRAY, items: { type: Type.STRING } },
    pose_or_orientation: { type: Type.STRING, nullable: true },
  },
  required: [
    "label",
    "category",
    "location",
    "visual_attributes",
    "micro_details",
    "pose_or_orientation",
  ],
};

export const VISIONSTRUCT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    image_type: { type: Type.STRING },
    composition: {
      type: Type.OBJECT,
      properties: {
        framing: { type: Type.STRING },
        focal_point: { type: Type.STRING },
        camera_angle: { type: Type.STRING },
        depth_of_field: { type: Type.STRING },
      },
      required: ["framing", "focal_point", "camera_angle", "depth_of_field"],
    },
    color_palette: {
      type: Type.OBJECT,
      properties: {
        accent_colors: { type: Type.ARRAY, items: { type: Type.STRING } },
        contrast_level: { type: Type.STRING },
        dominant_hex_estimates: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["accent_colors", "contrast_level", "dominant_hex_estimates"],
    },
    global_context: {
      type: Type.OBJECT,
      properties: {
        scene_description: { type: Type.STRING },
        time_of_day: { type: Type.STRING, nullable: true },
        weather_atmosphere: { type: Type.STRING, nullable: true },
        lighting: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING, nullable: true },
            quality: { type: Type.STRING, nullable: true },
            direction: { type: Type.STRING, nullable: true },
            color_temp: { type: Type.STRING, nullable: true },
          },
          required: ["source", "quality", "direction", "color_temp"],
        },
      },
      required: ["scene_description", "time_of_day", "weather_atmosphere", "lighting"],
    },
    objects: {
      type: Type.ARRAY,
      items: objectSchema,
    },
    semantic_relationships: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "image_type",
    "composition",
    "color_palette",
    "global_context",
    "objects",
    "semantic_relationships",
  ],
};

const DISPLAY_KEY_ORDER = [
  "image_type",
  "composition",
  "color_palette",
  "global_context",
  "objects",
  "semantic_relationships",
];

const NESTED_KEY_ORDER: Record<string, string[]> = {
  composition: ["framing", "focal_point", "camera_angle", "depth_of_field"],
  color_palette: ["accent_colors", "contrast_level", "dominant_hex_estimates"],
  global_context: ["scene_description", "time_of_day", "weather_atmosphere", "lighting"],
  lighting: ["source", "quality", "direction", "color_temp"],
};

function reorderObject(
  obj: Record<string, unknown>,
  topOrder: string[],
  nestedOrders: Record<string, string[]> = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const key of topOrder) {
    if (key in obj) {
      out[key] = obj[key];
      seen.add(key);
    }
  }
  for (const key of Object.keys(obj)) {
    if (!seen.has(key)) out[key] = obj[key];
  }
  for (const [key, order] of Object.entries(nestedOrders)) {
    if (key in out && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) {
      out[key] = reorderObject(out[key] as Record<string, unknown>, order, nestedOrders);
    }
  }
  return out;
}

export function reorderForDisplay(jsonPrompt: Record<string, unknown>): Record<string, unknown> {
  return reorderObject(jsonPrompt, DISPLAY_KEY_ORDER, NESTED_KEY_ORDER);
}

export type TagResult = {
  jsonPrompt: Record<string, unknown>;
  naturalPrompt: string;
  scenePrompt: Record<string, unknown>;
  tags: { tag: string; confidence: number }[];
  modelParams: {
    vision_model: string;
    prose_model: string;
    scene_model: string;
    prompt_version: string;
    vision_instruction: "default" | "custom";
    prose_instruction: "default" | "custom";
    scene_instruction: "default" | "custom";
  };
};

export type RunTaggerArgs = {
  base64Image: string;
  mimeType: string;
  apiKey: string;
  visionPrompt?: string | null;
  prosePrompt?: string | null;
  scenePrompt?: string | null;
  visionModel?: string | null;
  proseModel?: string | null;
  sceneModel?: string | null;
  dimensions?: { width: number; height: number } | null;
};

/**
 * SceneCompose pass: analyze the uploaded image directly and produce the
 * render-ready scene composition ("Ideogram") JSON. Works from the image
 * itself — not the VisionStruct JSON — so it captures detail the structured
 * analysis may have flattened. Shared by the full tagger and the backfill path.
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// "1080x1350" → "4:5". Empty string when dimensions are unknown.
export function aspectRatioString(width: number, height: number): string {
  if (!width || !height) return "";
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

/**
 * Attach the source image's real shape to a scene JSON. The bboxes are
 * normalized to a 1000×1000 canvas — aspect-independent by design — so the
 * true dimensions must travel alongside them or a downstream generator has no
 * way to know the image is portrait vs landscape (and renders it rotated).
 */
function withDimensions(
  scene: Record<string, unknown>,
  dimensions?: { width: number; height: number } | null
): Record<string, unknown> {
  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    scene.dimensions = { width: dimensions.width, height: dimensions.height };
    scene.aspect_ratio = aspectRatioString(dimensions.width, dimensions.height);
  }
  return scene;
}

async function sceneComposeWithClient(
  ai: GoogleGenAI,
  image: { base64Image: string; mimeType: string },
  scenePrompt?: string | null,
  sceneModel?: string | null,
  dimensions?: { width: number; height: number } | null
): Promise<Record<string, unknown>> {
  const sceneResponse = await ai.models.generateContent({
    model: sceneModel || SCENE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.base64Image } },
          { text: "Analyze this image and generate the scene composition JSON." },
        ],
      },
    ],
    config: {
      systemInstruction: scenePrompt || SCENECOMPOSE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: SCENECOMPOSE_RESPONSE_SCHEMA,
    },
  });

  const sceneText = sceneResponse.text || "{}";
  let scene: Record<string, unknown>;
  try {
    scene = JSON.parse(sceneText);
  } catch {
    scene = { raw_response: sceneText };
  }
  return withDimensions(scene, dimensions);
}

/**
 * Run only the SceneCompose pass against an image. Used to backfill
 * scene_prompt on prompts created before the third pass existed — runs a
 * single Gemini call against the asset's image, no vision/prose passes.
 */
export async function runSceneCompose({
  base64Image,
  mimeType,
  apiKey,
  scenePrompt,
  sceneModel,
  dimensions,
}: {
  base64Image: string;
  mimeType: string;
  apiKey: string;
  scenePrompt?: string | null;
  sceneModel?: string | null;
  dimensions?: { width: number; height: number } | null;
}): Promise<Record<string, unknown>> {
  const ai = new GoogleGenAI({ apiKey });
  return sceneComposeWithClient(ai, { base64Image, mimeType }, scenePrompt, sceneModel, dimensions);
}

export async function runTagger({
  base64Image,
  mimeType,
  apiKey,
  visionPrompt,
  prosePrompt,
  scenePrompt,
  visionModel,
  proseModel,
  sceneModel,
  dimensions,
}: RunTaggerArgs): Promise<TagResult> {
  const ai = new GoogleGenAI({ apiKey });

  const visionModelUsed = visionModel || VISION_MODEL;
  const proseModelUsed = proseModel || PROSE_MODEL;
  const sceneModelUsed = sceneModel || SCENE_MODEL;

  const visionResponse = await ai.models.generateContent({
    model: visionModelUsed,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: "Analyze this image and generate the JSON output." },
        ],
      },
    ],
    config: {
      systemInstruction: visionPrompt || VISIONSTRUCT_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: VISIONSTRUCT_RESPONSE_SCHEMA,
    },
  });

  const visionText = visionResponse.text || "{}";
  let jsonPrompt: Record<string, unknown>;
  try {
    jsonPrompt = JSON.parse(visionText);
  } catch {
    jsonPrompt = { raw_response: visionText };
  }

  const proseResponse = await ai.models.generateContent({
    model: proseModelUsed,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          {
            text:
              "Structured analysis of this image:\n```json\n" +
              JSON.stringify(jsonPrompt, null, 2) +
              "\n```\n\nWrite the prose paragraph.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: prosePrompt || PROMPTFORGE_SYSTEM_INSTRUCTION,
    },
  });

  const naturalPrompt = (proseResponse.text || "").trim();

  // Third pass: analyze the image directly to produce a render-ready scene
  // composition document. Independent of the VisionStruct JSON above.
  const scenePromptJson = await sceneComposeWithClient(
    ai,
    { base64Image, mimeType },
    scenePrompt,
    sceneModelUsed,
    dimensions
  );

  return {
    jsonPrompt,
    naturalPrompt,
    scenePrompt: scenePromptJson,
    tags: extractTags(jsonPrompt),
    modelParams: {
      vision_model: visionModelUsed,
      prose_model: proseModelUsed,
      scene_model: sceneModelUsed,
      prompt_version: PROMPT_VERSION,
      vision_instruction: visionPrompt ? "custom" : "default",
      prose_instruction: prosePrompt ? "custom" : "default",
      scene_instruction: scenePrompt ? "custom" : "default",
    },
  };
}

export function extractTags(
  jsonPrompt: Record<string, unknown>
): { tag: string; confidence: number }[] {
  const tags: { tag: string; confidence: number }[] = [];

  if (typeof jsonPrompt.image_type === "string") {
    tags.push({ tag: jsonPrompt.image_type, confidence: 0.95 });
  }

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

  const composition = jsonPrompt.composition as Record<string, unknown> | undefined;
  if (composition) {
    if (typeof composition.camera_angle === "string") {
      tags.push({ tag: composition.camera_angle, confidence: 0.85 });
    }
    if (typeof composition.framing === "string") {
      tags.push({ tag: composition.framing, confidence: 0.85 });
    }
  }

  const globalContext = jsonPrompt.global_context as Record<string, unknown> | undefined;
  if (globalContext) {
    if (typeof globalContext.weather_atmosphere === "string") {
      tags.push({ tag: globalContext.weather_atmosphere, confidence: 0.8 });
    }
    if (typeof globalContext.time_of_day === "string") {
      tags.push({ tag: globalContext.time_of_day, confidence: 0.8 });
    }
  }

  const colorPalette = jsonPrompt.color_palette as Record<string, unknown> | undefined;
  if (colorPalette && Array.isArray(colorPalette.accent_colors)) {
    colorPalette.accent_colors.forEach((color: unknown, index: number) => {
      if (typeof color === "string") {
        tags.push({ tag: color, confidence: 0.7 - index * 0.05 });
      }
    });
  }

  return tags.reduce((acc: typeof tags, tag) => {
    if (!acc.find((t) => t.tag.toLowerCase() === tag.tag.toLowerCase())) {
      acc.push(tag);
    }
    return acc;
  }, []);
}
