import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_SYSTEM_PROMPT, EDIT_SYSTEM_PROMPT, DUPLICATE_SYSTEM_PROMPT } from "@/lib/remix-prompts";

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


async function callModel(
  ai: GoogleGenAI,
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; model: string }> {
  const models = ["gemini-3-flash-preview", "gemini-2.5-flash"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userMessage,
        config: { systemInstruction: systemPrompt },
      });
      return { text: (response.text || "").trim(), model };
    } catch (err) {
      lastError = err as Error;
      const msg = (err as Error).message || "";
      if (
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("404") ||
        msg.includes("NOT_FOUND")
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All models failed");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mode,
      instruction,
      imagePrompts,
      components,
      instructions,
      imageIds,
      selectedPrompt,
      count = 3,
      apiKey,
      systemPrompt,
      editSystemPrompt,
    } = body;

    const geminiKey = apiKey || process.env.GEMINI_API_KEY || process.env.SECONDARY_LLM_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: "LLM API key not configured" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Backwards compat: no mode = legacy generate
    if (!mode || mode === "generate") {
      const effectiveInstruction = instruction || instructions;

      if (!imagePrompts?.length && !components?.length && !effectiveInstruction?.trim()) {
        return NextResponse.json({ error: "No image data or instructions provided" }, { status: 400 });
      }

      let sourcePromptsSection = "";

      if (imagePrompts && imagePrompts.length > 0) {
        sourcePromptsSection = (imagePrompts as ImagePromptData[])
          .sort((a, b) => a.imageIndex - b.imageIndex)
          .map((img) => {
            const imageLabel = `Image ${img.imageIndex + 1}`;
            const jsonStr = JSON.stringify(img.jsonPrompt, null, 2);
            return `[${imageLabel}]\n${jsonStr}`;
          })
          .join("\n\n");
      } else if (components && components.length > 0) {
        const componentsByImage: Record<string, { type: string; value: string }[]> = {};
        (components as PromptComponent[]).forEach((c) => {
          const imgLabel = `Image ${c.imageIndex + 1}`;
          if (!componentsByImage[imgLabel]) componentsByImage[imgLabel] = [];
          componentsByImage[imgLabel].push({ type: c.type, value: c.value });
        });

        sourcePromptsSection = Object.entries(componentsByImage)
          .map(([imgLabel, comps]) => {
            const fields = comps.map((c) => `  "${c.type}": "${c.value}"`).join(",\n");
            return `[${imgLabel}]\n{\n${fields}\n}`;
          })
          .join("\n\n");
      }

      const activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

      const userMessage = `SOURCE PROMPTS:

${sourcePromptsSection}

---

REMIX REQUEST:
${effectiveInstruction || "Combine all elements from the source images into a single cohesive scene, preserving the best qualities of each."}

---

Generate the final prompt now:`;

      const { text, model } = await callModel(ai, activeSystemPrompt, userMessage);

      return NextResponse.json({
        prompt: text,
        prompts: [text],
        components: components?.length || 0,
        imageIds,
        model,
      });
    }

    if (mode === "edit") {
      if (!selectedPrompt) {
        return NextResponse.json({ error: "selectedPrompt required for edit mode" }, { status: 400 });
      }

      const userMessage = `ORIGINAL PROMPT:
${selectedPrompt}

---

EDIT INSTRUCTION:
${instruction || "Refine and improve this prompt."}

---

Return the revised prompt now:`;

      const activeEditSystemPrompt = editSystemPrompt || EDIT_SYSTEM_PROMPT;
      const { text, model } = await callModel(ai, activeEditSystemPrompt, userMessage);

      return NextResponse.json({ prompts: [text], model });
    }

    if (mode === "duplicate") {
      if (!selectedPrompt) {
        return NextResponse.json({ error: "selectedPrompt required for duplicate mode" }, { status: 400 });
      }

      const numVariations = Math.max(1, Math.min(10, Number(count) || 3));

      const variationMessage = (i: number) => `ORIGINAL PROMPT:
${selectedPrompt}

---

VARIATION INSTRUCTION:
${instruction || "Create a distinct creative variation of this prompt."}

Generate variation ${i + 1} of ${numVariations}. Make it meaningfully different from the original and from other variations.

Return only the variation prompt:`;

      const results = await Promise.all(
        Array.from({ length: numVariations }, (_, i) =>
          callModel(ai, DUPLICATE_SYSTEM_PROMPT, variationMessage(i))
        )
      );

      const prompts = results.map((r) => r.text);
      const model = results[0]?.model || "unknown";

      return NextResponse.json({ prompts, model });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    console.error("Remix error:", error);
    const errorMessage = (error as Error).message || "";

    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        {
          error: "API rate limit exceeded. Please wait a moment and try again.",
          retryAfter: 30,
        },
        { status: 429 }
      );
    }

    if (errorMessage.includes("All models failed")) {
      return NextResponse.json(
        {
          error: "API rate limit exceeded. Please wait a moment and try again, or check your API key billing settings.",
          retryAfter: 30,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
